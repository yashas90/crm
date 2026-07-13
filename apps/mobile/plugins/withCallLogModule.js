const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

const CALL_LOG_MODULE_KT = `package com.propninja.crm

import android.Manifest
import android.content.pm.PackageManager
import android.provider.CallLog.Calls
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Reads the Android system call log to retrieve the actual talk duration
 * (time from when the remote party answers to hang-up — ring time excluded by the OS).
 */
class CallLogModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "CallLogModule"

    @ReactMethod
    fun getLastCallDuration(phoneNumber: String, afterTimestampMs: Double, promise: Promise) {
        if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.READ_CALL_LOG)
            != PackageManager.PERMISSION_GRANTED
        ) {
            promise.resolve(null)
            return
        }

        try {
            val cursor = reactContext.contentResolver.query(
                Calls.CONTENT_URI,
                arrayOf(Calls.DURATION, Calls.DATE, Calls.NUMBER, Calls.TYPE),
                "\${Calls.TYPE} = ? AND \${Calls.DATE} >= ?",
                arrayOf(Calls.OUTGOING_TYPE.toString(), afterTimestampMs.toLong().toString()),
                "\${Calls.DATE} DESC",
            )

            cursor?.use {
                val durationIdx = it.getColumnIndexOrThrow(Calls.DURATION)
                val numberIdx   = it.getColumnIndexOrThrow(Calls.NUMBER)

                while (it.moveToNext()) {
                    val number   = it.getString(numberIdx) ?: continue
                    val duration = it.getLong(durationIdx)
                    if (numbersMatch(number, phoneNumber)) {
                        promise.resolve(duration.toDouble())
                        return
                    }
                }
            }

            promise.resolve(null)
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }

    private fun numbersMatch(a: String, b: String): Boolean {
        val clean = { s: String -> s.replace(Regex("[^\\\\d]"), "").takeLast(10) }
        val ca = clean(a)
        val cb = clean(b)
        return ca.isNotEmpty() && ca == cb
    }
}
`;

const CALL_LOG_PACKAGE_KT = `package com.propninja.crm

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class CallLogPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
        listOf(CallLogModule(context))

    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;

/**
 * Writes the Kotlin source files into the generated Android project.
 */
function withCallLogKotlinFiles(config) {
  return withDangerousMod(config, [
    "android",
    (modConfig) => {
      const srcDir = path.join(
        modConfig.modRequest.platformProjectRoot,
        "app/src/main/java/com/propninja/crm",
      );

      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, "CallLogModule.kt"), CALL_LOG_MODULE_KT, "utf8");
      fs.writeFileSync(path.join(srcDir, "CallLogPackage.kt"), CALL_LOG_PACKAGE_KT, "utf8");

      // Patch MainApplication.kt to register CallLogPackage
      const mainAppPath = path.join(srcDir, "MainApplication.kt");
      if (fs.existsSync(mainAppPath)) {
        let src = fs.readFileSync(mainAppPath, "utf8");

        const alreadyPatched = src.includes("CallLogPackage");
        if (!alreadyPatched) {
          src = src.replace(
            "val packages = PackageList(this).packages",
            "val packages = PackageList(this).packages\n            packages.add(CallLogPackage())",
          );
          fs.writeFileSync(mainAppPath, src, "utf8");
        }
      }

      return modConfig;
    },
  ]);
}

/**
 * Adds READ_CALL_LOG to AndroidManifest.xml.
 */
function withCallLogPermission(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    if (!manifest["uses-permission"]) manifest["uses-permission"] = [];

    const alreadyDeclared = manifest["uses-permission"].some(
      (p) => p.$?.["android:name"] === "android.permission.READ_CALL_LOG",
    );

    if (!alreadyDeclared) {
      manifest["uses-permission"].push({
        $: { "android:name": "android.permission.READ_CALL_LOG" },
      });
    }

    return modConfig;
  });
}

function withCallLogModule(config) {
  return withCallLogKotlinFiles(withCallLogPermission(config));
}

module.exports = withCallLogModule;
