import cn from 'classnames';
import React from 'react';

function Dot({
  currentStep,
  thisStep,
  setStep,
}: {
  currentStep: number;
  thisStep: number;
  setStep: (step: number) => void;
}) {
  return (
    <div
      onClick={() => setStep(thisStep - 1)}
      className={cn('h-2 w-2 cursor-pointer rounded-full', {
        'bg-black': currentStep === thisStep,
        'bg-gray-100': currentStep !== thisStep,
      })}
    />
  );
}

export default function NavigationDots({
  maxStep,
  currentStep,
  setStep,
}: {
  maxStep: number;
  currentStep: number;
  setStep: (step: number) => void;
}) {
  return (
    <div className="flex space-x-2">
      {[...Array(maxStep).keys()].map((step) => (
        <Dot
          // Add 1 to account for 0.
          key={`dot-${step + 1}`}
          currentStep={currentStep}
          thisStep={step + 1}
          setStep={setStep}
        />
      ))}
    </div>
  );
}
