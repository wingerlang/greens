/**
 * ZenMode - Fullscreen distraction-free cooking view
 */

import React, { useCallback, useEffect } from "react";
import { type ParsedStep } from "../../utils/stepParser.ts";
import { formatTime, type Timer } from "../../hooks/useTimer.ts";
import { type ScaledIngredient } from "../../hooks/useCookingSession.ts";
import { type FoodItem } from "../../models/types.ts";
import { formatIngredientQuantity } from "../../utils/unitHelper.ts";
import { matchToFoodItem } from "../../utils/ingredientParser.ts";
import "./ZenMode.css";

interface ZenModeProps {
  recipeName: string;
  steps: ParsedStep[];
  ingredients: ScaledIngredient[];
  foodItems: FoodItem[];
  currentStep: number;
  timer: Timer | null; // The specific timer for THIS step
  activeTimers?: Timer[]; // All currently active timers
  onNextStep: () => void;
  onPreviousStep: () => void;
  onStartTimer: (minutes?: number) => void;
  onPauseTimer: () => void;
  onResetTimer: () => void;
  onExit: () => void;
  onGoToStep?: (index: number) => void;
}

export function ZenMode({
  recipeName,
  steps,
  ingredients,
  foodItems,
  currentStep,
  timer,
  activeTimers = [],
  onNextStep,
  onPreviousStep,
  onStartTimer,
  onPauseTimer,
  onResetTimer,
  onExit,
  onGoToStep,
}: ZenModeProps) {
  const step = steps[currentStep];
  const totalSteps = steps.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  // Manual time state for inferred timers
  const [manualTime, setManualTime] = React.useState<number>(0);

  useEffect(() => {
    if (step?.timerMinutes) {
      setManualTime(step.timerMinutes);
    }
  }, [step]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          onNextStep();
          break;
        case "ArrowLeft":
          e.preventDefault();
          onPreviousStep();
          break;
        case "Escape":
          onExit();
          break;
        case "t":
        case "T":
          if (timer) {
            if (timer.status === "running") {
              onPauseTimer();
            } else {
              onStartTimer(); // Resume or start existing? No, this handles pause/resume logic check in parent usually or standard start
            }
          } else if (step?.timerMinutes) {
            onStartTimer(manualTime || step.timerMinutes);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNextStep, onPreviousStep, onExit, timer, onStartTimer, onPauseTimer]);

  if (!step) return null;

  return (
    <div className="zen-mode">
      {/* Header */}
      <header className="zen-header">
        <span className="zen-title">
          {recipeName.toUpperCase()} — STEG {currentStep + 1} AV {totalSteps}
        </span>
        <button className="zen-exit-btn" onClick={onExit}>
          × AVSLUTA
        </button>
      </header>

      {/* Progress Bar */}
      <div className="zen-progress">
        <div className="zen-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Main Content */}
      <main className="zen-content">
        {/* Ingredient Context - CUSTOMIZED DISPLAY */}
        {/* Ingredient Context - CUSTOMIZED DISPLAY */}
        {step.ingredients.length > 0 && (() => {
          // Check if ingredients have been used before
          const reusedIngredients = step.ingredients.map((ing) => {
            for (let i = 0; i < currentStep; i++) {
              const prevStep = steps[i];
              const wasUsed = prevStep.ingredients.some((pi) =>
                pi.originalText === ing.originalText
              );
              if (wasUsed) {
                // Try to infer state from previous step text
                const textLower = prevStep.text.toLowerCase();
                const nameLower = ing.name.toLowerCase();

                // Simple Swedish state inference
                let state = "";
                if (textLower.includes("tärna")) state = "Tärnad";
                if (textLower.includes("hacka")) state = "Hackad";
                if (textLower.includes("skiva")) state = "Skivad";
                if (textLower.includes("strimla")) state = "Strimlad";
                if (textLower.includes("riv")) state = "Riven";
                if (textLower.includes("mosa")) state = "Mosad";
                if (textLower.includes("stek")) state = "Stekt";
                if (textLower.includes("koka")) state = "Kokt";

                return { used: true, state };
              }
            }
            return { used: false, state: "" };
          });

          const allReused = reusedIngredients.every((r) => r.used);
          const anyReused = reusedIngredients.some((r) => r.used);

          const label = allReused ? "↓ TILLSÄTT" : "↓ HÄLL I DETTA NU";

          return (
            <div className="zen-ingredient-context">
              <span className="context-label">{label}</span>
              <div
                className="context-ingredients-list"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  justifyContent: "center",
                }}
              >
                {step.ingredients.map((stepIng, idx) => {
                  // Find matched scaled ingredient
                  const scaled = ingredients.find((si) =>
                    si.originalText === stepIng.originalText
                  );
                  if (!scaled || scaled.isExcluded) return null;

                  const reuseInfo = reusedIngredients[idx];

                  // Format quantity with potential dl/g conversion
                  const quantity = parseFloat(
                    scaled.scaledAmount.replace(",", "."),
                  );
                  const foodItem = matchToFoodItem({
                    name: scaled.name,
                    originalText: scaled.originalText,
                    quantity: quantity,
                    unit: scaled.unit,
                  }, foodItems);

                  const formattedText = !isNaN(quantity)
                    ? formatIngredientQuantity(
                      quantity,
                      scaled.unit,
                      foodItem || undefined,
                    )
                    : `${scaled.scaledAmount} ${scaled.unit}`; // Fallback if parse fails

                  // If reused, we might hide the amount or show it differently?
                  // User asked: "skriva ut 'häll i tärnad tofu'"
                  // If generic reused, maybe suppress amount? No, always good to verify amount.
                  // Let's prepend the state if found.

                  const displayText = reuseInfo.used && reuseInfo.state
                    ? `${reuseInfo.state} ${scaled.name}`
                    : scaled.name;

                  return (
                    <span
                      key={idx}
                      className="context-ingredient-chip"
                      style={{
                        background: reuseInfo.used
                          ? "rgba(16, 185, 129, 0.2)"
                          : "rgba(255,255,255,0.1)",
                        border: reuseInfo.used
                          ? "1px solid rgba(16, 185, 129, 0.3)"
                          : "none",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {/* If reused, maybe smaller amount or just the name? Let's keep amount for clarity but maybe dim it */}
                      <span style={{ opacity: reuseInfo.used ? 0.7 : 1 }}>
                        {formattedText}
                      </span>{" "}
                      {displayText}
                      {scaled.customMultiplier &&
                        scaled.customMultiplier !== 1 && (
                        <span
                          style={{
                            color: "#10b981",
                            marginLeft: "4px",
                            fontSize: "0.8em",
                          }}
                        >
                          ({Math.round(scaled.customMultiplier * 100)}%)
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Step Text */}
        <p className="zen-step-text">{step.text}</p>

        {/* Timer */}
        {(step.timerMinutes || timer) && (
          <div className="zen-timer-section">
            <div className="zen-timer-display">
              {formatTime(timer?.remainingSeconds || (manualTime || 0) * 60)}
            </div>
            <div className="zen-timer-controls">
              {!timer && step.isManualTimer && (
                <div
                  className="timer-adjust-controls"
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginBottom: "8px",
                    justifyContent: "center",
                  }}
                >
                  <button
                    className="zen-adjust-btn"
                    onClick={() =>
                      setManualTime((m: number) => Math.max(1, m - 1))}
                  >
                    -1m
                  </button>
                  <button
                    className="zen-adjust-btn"
                    onClick={() =>
                      setManualTime((m: number) => Math.max(1, m - 5))}
                  >
                    -5m
                  </button>
                  <button
                    className="zen-adjust-btn"
                    onClick={() => setManualTime((m: number) => m + 5)}
                  >
                    +5m
                  </button>
                  <button
                    className="zen-adjust-btn"
                    onClick={() => setManualTime((m: number) => m + 1)}
                  >
                    +1m
                  </button>
                </div>
              )}
              {timer?.status === "running"
                ? (
                  <button className="timer-btn" onClick={onPauseTimer}>
                    ⏸ PAUSA
                  </button>
                )
                : (
                  <button
                    className="timer-btn timer-btn-primary"
                    onClick={() => onStartTimer(manualTime)}
                  >
                    ▶ STARTA TIMER
                  </button>
                )}
              <button
                className="timer-btn timer-btn-icon"
                onClick={onResetTimer}
              >
                ↺
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Navigation */}
      <footer className="zen-nav">
        <button
          className="zen-nav-btn zen-nav-prev"
          onClick={onPreviousStep}
          disabled={currentStep === 0}
        >
          ← FÖREGÅENDE
        </button>

        {/* Helper to calculate visible active timers (exclude current step timer from background list if shown in main area) */}
        {(() => {
          // Show timers in background list provided they are running
          // We might exclude the current step's timer IF it is currently displayed in the main view (status running/paused and step.timerMinutes exists)
          // But simpler: Just list ALL running timers in the corner, unless it's the main focus?
          // User said: "glasklart vilka som är vilka"
          // Let's list all running timers in the overlay.
          const overlayTimers = activeTimers.filter((t) =>
            t.status === "running"
          );

          if (overlayTimers.length === 0) return null;

          return (
            <div
              className="zen-timers-overlay"
              style={{
                position: "fixed", // Fixed to stay on screen
                bottom: "80px",
                right: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                zIndex: 100,
                pointerEvents: "none", // Allow clicking through empty space
              }}
            >
              {overlayTimers.map((t) => (
                <div
                  key={t.id}
                  className="zen-timer-toast"
                  style={{
                    background: "rgba(0,0,0,0.8)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    color: "white",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                    pointerEvents: "auto",
                    backdropFilter: "blur(4px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      cursor: "pointer",
                      minWidth: "80px",
                    }}
                    onClick={() => onGoToStep && onGoToStep(t.stepIndex)}
                    title={`Gå till ${t.label}`}
                  >
                    <span
                      style={{
                        fontSize: "0.75em",
                        opacity: 0.8,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {t.label}
                    </span>
                    <span
                      style={{
                        fontWeight: "bold",
                        fontFamily: "monospace",
                        fontSize: "1.1em",
                      }}
                    >
                      {formatTime(t.remainingSeconds)}
                    </span>
                  </div>
                  {/* Small indicator that it's running */}
                  <span
                    className="pulsing-dot"
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#34d399",
                      boxShadow: "0 0 8px #34d399",
                    }}
                  />
                </div>
              ))}
            </div>
          );
        })()}

        <button
          className={`zen-nav-btn zen-nav-next ${
            currentStep === totalSteps - 1 ? "zen-nav-finish" : ""
          }`}
          onClick={currentStep === totalSteps - 1 ? onExit : onNextStep}
        >
          {currentStep === totalSteps - 1
            ? "Smaklig måltid! 🌟"
            : "Nästa steg →"}
        </button>
      </footer>
    </div>
  );
}
