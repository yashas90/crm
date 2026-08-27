const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

const TRACKING_NATIVE_MODULE_KT = `package com.propninja.crm

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.TimeUnit

/**
 * Battery-optimization exemption + last-boot timestamp + WorkManager watchdog.
 * Force-stop still kills the FGS until the next boot / significant motion (OS limit).
 */
class TrackingNativeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "TrackingNativeModule"

    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                promise.resolve(true)
                return
            }
            val pm = reactContext.getSystemService(Context.POWER_SERVICE) as PowerManager
            promise.resolve(pm.isIgnoringBatteryOptimizations(reactContext.packageName))
        } catch (e: Exception) {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimizations(promise: Promise) {
        try {
            val pkg = reactContext.packageName
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:\$pkg")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            try {
                val fallback = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(fallback)
                promise.resolve(true)
            } catch (e2: Exception) {
                promise.reject("BATTERY_SETTINGS", e2)
            }
        }
    }

    @ReactMethod
    fun getLastBootAtMs(promise: Promise) {
        val prefs = reactContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        promise.resolve(prefs.getLong(LAST_BOOT_AT, 0).toDouble())
    }

    @ReactMethod
    fun scheduleWatchdog(promise: Promise) {
        try {
            TrackingBootstrap.schedule(reactContext.applicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WATCHDOG", e)
        }
    }

    companion object {
        const val PREFS = "propninja_tracking"
        const val LAST_BOOT_AT = "last_boot_at"
        const val WORK_NAME = "propninja_location_watchdog"
    }
}

object TrackingBootstrap {
    fun recordBoot(context: Context) {
        context.getSharedPreferences(TrackingNativeModule.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putLong(TrackingNativeModule.LAST_BOOT_AT, System.currentTimeMillis())
            .apply()
    }

    fun schedule(context: Context) {
        val work = PeriodicWorkRequestBuilder<LocationWatchdogWorker>(30, TimeUnit.MINUTES)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            TrackingNativeModule.WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            work,
        )
        TrackingAlarms.schedule(context)
    }

    fun restartTracking(context: Context) {
        recordBoot(context)
        schedule(context)
        try {
            val cls = Class.forName("expo.modules.location.services.LocationTaskService")
            val intent = Intent(context, cls)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        } catch (_: Exception) {
            // Expo location FGS class name can vary; WorkManager + JS watchdog still recover.
        }
    }
}
`;

const TRACKING_PACKAGE_KT = `package com.propninja.crm

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class TrackingPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
        listOf(TrackingNativeModule(context))

    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;

const BOOT_RECEIVER_KT = `package com.propninja.crm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Restarts background location after reboot / app update. No agent action required.
 * Force-stop: Android will not deliver this until the user (or a boot) starts the app again.
 */
class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (
            action == Intent.ACTION_BOOT_COMPLETED ||
            action == Intent.ACTION_LOCKED_BOOT_COMPLETED ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED ||
            action == "android.intent.action.QUICKBOOT_POWERON" ||
            action == "com.htc.intent.action.QUICKBOOT_POWERON"
        ) {
            TrackingBootstrap.restartTracking(context.applicationContext)
        }
    }
}
`;

const ALARM_RECEIVER_KT = `package com.propninja.crm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar
import java.util.TimeZone

/** 09:30 IST resume / 20:30 IST pause-keep-alive. Service stays running overnight. */
class TrackingAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        TrackingBootstrap.restartTracking(context.applicationContext)
        TrackingAlarms.schedule(context.applicationContext)
    }
}

object TrackingAlarms {
    private const val REQ_RESUME = 9301
    private const val REQ_PAUSE = 2030

    fun schedule(context: Context) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        setExact(am, context, REQ_RESUME, 9, 30)
        setExact(am, context, REQ_PAUSE, 20, 30)
    }

    private fun setExact(
        am: AlarmManager,
        context: Context,
        requestCode: Int,
        hour: Int,
        minute: Int,
    ) {
        val intent = Intent(context, TrackingAlarmReceiver::class.java)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val pi = PendingIntent.getBroadcast(context, requestCode, intent, flags)
        val triggerAt = nextIstMillis(hour, minute)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pi)
            }
        } catch (_: Exception) {
            am.set(AlarmManager.RTC_WAKEUP, triggerAt, pi)
        }
    }

    private fun nextIstMillis(hour: Int, minute: Int): Long {
        val tz = TimeZone.getTimeZone("Asia/Kolkata")
        val cal = Calendar.getInstance(tz)
        cal.set(Calendar.HOUR_OF_DAY, hour)
        cal.set(Calendar.MINUTE, minute)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        if (cal.timeInMillis <= System.currentTimeMillis() + 5_000) {
            cal.add(Calendar.DAY_OF_YEAR, 1)
        }
        return cal.timeInMillis
    }
}
`;

const WATCHDOG_WORKER_KT = `package com.propninja.crm

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

/**
 * WorkManager fallback every 30 minutes: if the FGS died, try to restart it.
 * Cannot recover a user force-stop until boot or the user opens the app (Android OS limit).
 */
class LocationWatchdogWorker(appContext: Context, params: WorkerParameters) :
    Worker(appContext, params) {
    override fun doWork(): Result {
        TrackingBootstrap.restartTracking(applicationContext)
        return Result.success()
    }
}
`;

function withTrackingKotlinFiles(config) {
  return withDangerousMod(config, [
    "android",
    (modConfig) => {
      const srcDir = path.join(
        modConfig.modRequest.platformProjectRoot,
        "app/src/main/java/com/propninja/crm",
      );
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        path.join(srcDir, "TrackingNativeModule.kt"),
        TRACKING_NATIVE_MODULE_KT,
        "utf8",
      );
      fs.writeFileSync(path.join(srcDir, "TrackingPackage.kt"), TRACKING_PACKAGE_KT, "utf8");
      fs.writeFileSync(path.join(srcDir, "BootCompletedReceiver.kt"), BOOT_RECEIVER_KT, "utf8");
      fs.writeFileSync(path.join(srcDir, "TrackingAlarmReceiver.kt"), ALARM_RECEIVER_KT, "utf8");
      fs.writeFileSync(path.join(srcDir, "LocationWatchdogWorker.kt"), WATCHDOG_WORKER_KT, "utf8");

      const mainAppPath = path.join(srcDir, "MainApplication.kt");
      if (fs.existsSync(mainAppPath)) {
        let src = fs.readFileSync(mainAppPath, "utf8");
        if (!src.includes("TrackingPackage")) {
          src = src.replace(
            "val packages = PackageList(this).packages",
            "val packages = PackageList(this).packages\n            packages.add(TrackingPackage())",
          );
          fs.writeFileSync(mainAppPath, src, "utf8");
        }
      }
      return modConfig;
    },
  ]);
}

function withTrackingManifest(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    if (!manifest["uses-permission"]) manifest["uses-permission"] = [];

    const needed = [
      "android.permission.RECEIVE_BOOT_COMPLETED",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_LOCATION",
      "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
      "android.permission.SCHEDULE_EXACT_ALARM",
      "android.permission.USE_EXACT_ALARM",
      "android.permission.WAKE_LOCK",
    ];
    for (const name of needed) {
      const already = manifest["uses-permission"].some((p) => p.$?.["android:name"] === name);
      if (!already) {
        manifest["uses-permission"].push({ $: { "android:name": name } });
      }
    }

    const app = manifest.application?.[0];
    if (app) {
      if (!app.receiver) app.receiver = [];
      if (!app.service) app.service = [];

      const hasBoot = app.receiver.some(
        (r) => r.$?.["android:name"] === "com.propninja.crm.BootCompletedReceiver",
      );
      if (!hasBoot) {
        app.receiver.push({
          $: {
            "android:name": "com.propninja.crm.BootCompletedReceiver",
            "android:enabled": "true",
            "android:exported": "true",
            "android:directBootAware": "true",
          },
          "intent-filter": [
            {
              action: [
                { $: { "android:name": "android.intent.action.BOOT_COMPLETED" } },
                { $: { "android:name": "android.intent.action.LOCKED_BOOT_COMPLETED" } },
                { $: { "android:name": "android.intent.action.MY_PACKAGE_REPLACED" } },
                { $: { "android:name": "android.intent.action.QUICKBOOT_POWERON" } },
                { $: { "android:name": "com.htc.intent.action.QUICKBOOT_POWERON" } },
              ],
            },
          ],
        });
      }

      const hasAlarm = app.receiver.some(
        (r) => r.$?.["android:name"] === "com.propninja.crm.TrackingAlarmReceiver",
      );
      if (!hasAlarm) {
        app.receiver.push({
          $: {
            "android:name": "com.propninja.crm.TrackingAlarmReceiver",
            "android:exported": "false",
          },
        });
      }
    }

    return modConfig;
  });
}

function withBulletproofTracking(config) {
  return withTrackingKotlinFiles(withTrackingManifest(config));
}

module.exports = withBulletproofTracking;
