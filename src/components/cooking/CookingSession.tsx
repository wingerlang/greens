/**
 * CookingSession - Main cooking mode orchestrator (Köksläge)
 */

import React, { useEffect } from "react";
import { type ParsedStep } from "../../utils/stepParser.ts";
import { formatTime, type Timer } from "../../hooks/useTimer.ts";
import { type MatchedIngredient } from "../../utils/stepParser.ts";
import "./CookingSession.css";

interface ScaledIngredient extends MatchedIngredient {
  scaledAmount: string;
}

interface CookingSessionProps {
  recipeName: string;
  steps: ParsedStep[];
  currentStep: number;
  completedSteps: number[];
  ingredients: ScaledIngredient[];
  timer: Timer | null;
  onGoToStep: (index: number) => void;
  onCompleteStep: (index: number) => void;
  onEnterZenMode: () => void;
  onStartTimer: (stepIndex: number, minutes: number) => void;
  onExit: () => void;
}

export function CookingSession({
  recipeName,
  steps,
  currentStep,
  completedSteps,
  ingredients,
  timer,
  onGoToStep,
  onCompleteStep,
  onEnterZenMode,
  onStartTimer,
  onExit,
}: CookingSessionProps) {
  // ESC key to exit
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onExit();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onExit]);

  return (
    <div className="cooking-session">
      {/* Header */}
      <header className="cooking-header">
        <div className="cooking-title">
          <span className="cooking-label">KÖKSLÄGE AKTIVT</span>
          <h1>{recipeName}</h1>
        </div>
        <div className="cooking-actions">
          <button className="btn-exit" onClick={onExit}>
            × Avsluta
          </button>
        </div>
      </header>

      {/* Zen Mode Button */}
      <button className="zen-mode-btn" onClick={onEnterZenMode}>
        <span className="zen-icon">▶</span>
        Starta Zen Mode (Steg-för-steg)
      </button>

      {/* Steps List */}
      <div className="steps-list">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(index);
          const isCurrent = index === currentStep;

          return (
            <div
              key={index}
              className={`step-item ${isCompleted ? "completed" : ""} ${
                isCurrent ? "current" : ""
              }`}
              onClick={() => onGoToStep(index)}
            >
              <div className="step-number">
                {isCompleted
                  ? <span className="check-icon">✓</span>
                  : <span>{index + 1}</span>}
              </div>
              <div className="step-content">
                <p className="step-text">{step.text}</p>

                {/* Ingredient badges */}
                {step.ingredients.length > 0 && (
                  <div className="step-ingredients">
                    {step.ingredients.map((ing, i) => (
                      <span key={i} className="ingredient-badge">
                        {ing.originalText}
                      </span>
                    ))}
                  </div>
                )}

                {/* Timer indicator */}
                {step.timerMinutes && (
                  <button
                    className="step-timer-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartTimer(index, step.timerMinutes!);
                    }}
                  >
                    ⏱ {step.timerMinutes} min
                  </button>
                )}
              </div>

              {/* Completion checkbox */}
              <button
                className="step-check-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onCompleteStep(index);
                }}
              >
                {isCompleted ? "✓" : "○"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Active Timer Display - NOW CLICKABLE & DESCRIPTIVE */}
      {timer && timer.status === "running" && (
        <div
          className="floating-timer"
          onClick={() => onGoToStep(timer.stepIndex)}
          style={{ cursor: "pointer" }}
          title={`Gå till steg ${timer.stepIndex + 1}`}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            }}
          >
            <span
              className="timer-label"
              style={{ fontSize: "0.8em", opacity: 0.9 }}
            >
              ⏱ {timer.label}
            </span>
            <span
              style={{
                fontSize: "0.7em",
                textTransform: "uppercase",
                opacity: 0.7,
              }}
            >
              Steg {timer.stepIndex + 1}
            </span>
          </div>
          <span className="timer-value">
            {formatTime(timer.remainingSeconds)}
          </span>
        </div>
      )}
    </div>
  );
}
