"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type StepRunnerState = "idle" | "running" | "done";

export type UseStepRunnerOptions = {
  totalSteps: number;
  stepMs?: number;
};

export type UseStepRunnerResult = {
  state: StepRunnerState;
  currentStep: number;
  start: () => void;
  reset: () => void;
  isVisible: (index: number) => boolean;
  isActive: (index: number) => boolean;
};

export function useStepRunner({
  totalSteps,
  stepMs = 600,
}: UseStepRunnerOptions): UseStepRunnerResult {
  const [state, setState] = useState<StepRunnerState>("idle");
  const [currentStep, setCurrentStep] = useState(-1);
  const tokenRef = useRef(0);

  useEffect(() => {
    return () => {
      tokenRef.current += 1;
    };
  }, []);

  const reset = useCallback(() => {
    tokenRef.current += 1;
    setState("idle");
    setCurrentStep(-1);
  }, []);

  const start = useCallback(() => {
    tokenRef.current += 1;
    const myToken = tokenRef.current;
    setState("running");
    setCurrentStep(-1);

    let i = 0;
    const tick = () => {
      if (myToken !== tokenRef.current) return;
      if (i >= totalSteps) {
        setCurrentStep(totalSteps - 1);
        setState("done");
        return;
      }
      setCurrentStep(i);
      i += 1;
      window.setTimeout(tick, stepMs);
    };
    window.setTimeout(tick, stepMs);
  }, [totalSteps, stepMs]);

  const isVisible = useCallback(
    (index: number) => {
      if (state === "idle") return false;
      if (state === "done") return true;
      return index <= currentStep;
    },
    [state, currentStep],
  );

  const isActive = useCallback(
    (index: number) => state === "running" && index === currentStep,
    [state, currentStep],
  );

  return { state, currentStep, start, reset, isVisible, isActive };
}
