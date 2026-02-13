import React from 'react';

const STEPS = [
  { number: 1, label: 'Cliente' },
  { number: 2, label: 'Projeto' },
  { number: 3, label: 'Negócio' },
];

function WizardNavigation({ currentStep }) {
  return (
    <div className="wizard-navigation">
      {STEPS.map((step, index) => (
        <React.Fragment key={step.number}>
          <div className={`wizard-step-indicator ${
            step.number < currentStep ? 'completed' :
            step.number === currentStep ? 'active' : 'pending'
          }`}>
            <div className="wizard-step-circle">
              {step.number < currentStep ? '✓' : step.number}
            </div>
            <span className="wizard-step-label">{step.label}</span>
          </div>
          {index < STEPS.length - 1 && (
            <div className={`wizard-step-line ${step.number < currentStep ? 'completed' : ''}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default WizardNavigation;
