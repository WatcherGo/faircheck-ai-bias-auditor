# AI Bias Audit Platform

A professional-grade auditing platform designed to detect, visualize, and mitigate algorithmic bias in machine learning models.

## 🚀 Features

- **Bias Metrics Visualization**: Real-time monitoring of critical fairness metrics:
  - **Disparate Impact Ratio**: Identifying proportion differences in favorable outcomes.
  - **Statistical Parity Difference**: Measuring the gap in selection rates between groups.
  - **Equal Opportunity Difference**: Comparing true positive rates across protected attributes.
- **Root Cause Analysis**: AI-powered insights that correlate features with biased outcomes.
- **Fairness Simulator**: Interactive threshold control to see how decision boundaries affect fairness vs. accuracy.
- **One-Click Mitigation**: Simulation of reweighting techniques to balance model outcomes.
- **Responsive Design**: Polished, dark-themed interface built with Tailwind CSS and Framer Motion.

## 🛠️ Tech Stack

- **Framework**: React 18+ with Vite
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Data Visualization**: Recharts & Custom SVG Gauges
- **Language**: TypeScript

## 📊 Fairness Metrics Explained

| Metric | Goal | Threshold |
| :--- | :--- | :--- |
| **Disparate Impact** | Value > 0.85 | Avoids "80% rule" violations |
| **Stat. Parity** | Value < 0.05 | Ensures groups receive similar outcomes |
| **Equal Opportunity** | Value < 0.05 | Ensures model is equally "accurate" for all groups |

## 🧪 Simulation Data

The platform comes with pre-loaded datasets including:
- **Loan Approvals**: Monitoring bias in credit scoring.
- **Hiring Pipeline**: Auditing gender and ethnicity bias in recruitment.
- **Health Risk**: Analyzing disparities in medical triage algorithms.

---
*Note: This platform is a simulation for educational and auditing demonstration purposes.*
