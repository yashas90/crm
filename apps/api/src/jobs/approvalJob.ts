import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { createApprovalService } from "../services/approvalService.js";

export function startApprovalJob() {
  const run = () => {
    void createApprovalService(db)
      .runDaily(new Date())
      .catch((err) => {
        logger.warn("Incentive and appraisal approval job failed", {
          err: err instanceof Error ? err.message : String(err),
        });
      });
  };
  run();
  setInterval(run, 60 * 60 * 1000).unref();
}
