import React from "react";
import { useShallow } from "zustand/react/shallow";
import { useDownloadStore } from "../store/useDownloadStore";
import { useLanguage } from "../hooks/useLanguage";
import { IconZap } from "./Icons";
import type { SpeedMode } from "../types";

const MODES: SpeedMode[] = ["slow", "medium", "fast"];

/**
 * Global download-speed selector, pinned to the bottom of the main screen.
 * Applies to every download queued from then on (single, multi-paste, and
 * playlist) — the chosen mode + editable Slow/Medium caps live in the store
 * and are read back into `buildFormatArgs()` as `--limit-rate` wherever a
 * download is started (see AddDownloadModal.tsx).
 */
export const SpeedModeBar: React.FC = () => {
  const { t } = useLanguage();
  const { speedMode, setSpeedMode, speedLimits } = useDownloadStore(
    useShallow((s) => ({
      speedMode: s.speedMode,
      setSpeedMode: s.setSpeedMode,
      speedLimits: s.speedLimits,
    }))
  );

  const labels: Record<SpeedMode, string> = {
    slow: t("speedMode_slow"),
    medium: t("speedMode_medium"),
    fast: t("speedMode_fast"),
  };

  const tooltips: Record<SpeedMode, string> = {
    slow: t("speedMode_slowTooltip").replace("{limit}", String(speedLimits.slow)),
    medium: t("speedMode_mediumTooltip").replace("{limit}", String(speedLimits.medium)),
    fast: t("speedMode_fastTooltip"),
  };

  return (
    <div className="speed-mode-bar">
      <span className="speed-mode-bar__label">
        <IconZap size={14} />
        {t("speedMode_label")}
      </span>
      <div className="speed-mode-bar__options">
        {MODES.map((mode) => (
          <button
            key={mode}
            className={`speed-mode-btn speed-mode-btn--${mode}${speedMode === mode ? " speed-mode-btn--active" : ""}`}
            onClick={() => setSpeedMode(mode)}
            title={tooltips[mode]}
            aria-pressed={speedMode === mode}
          >
            <span className="speed-mode-btn__dot" />
            {labels[mode]}
          </button>
        ))}
      </div>
    </div>
  );
};
