export interface Applicant {
  id: string;
  gender?: string;
  race?: string;
  years_experience?: number;
  education?: string;
  hired: boolean;
  score: number; // raw model score
}

export interface LoanApplicant {
  id: string;
  race: string;
  age: number;
  income: number;
  credit_score: number;
  approved: boolean;
  score: number;
}

export interface Patient {
  id: string;
  age: number;
  gender: string;
  pain_score: number;
  wait_time: number;
  treated_priority: boolean;
  score: number;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  icon: string;
  size: number;
  finding: string;
  protected_feature: string;
  privileged_group: string;
  unprivileged_group: string;
  outcome_label: string;
  data: any[];
}

// Helper to generate synthetic data with controlled bias
const generateHiringData = (count: number): Applicant[] => {
  return Array.from({ length: count }, (_, i) => {
    const isMale = Math.random() > 0.5;
    const gender = isMale ? 'Male' : 'Female';
    const yearsExp = Math.floor(Math.random() * 15);
    const hasDegree = Math.random() > 0.3;
    
    // Base score from experience and education
    let score = (yearsExp * 0.05) + (hasDegree ? 0.2 : 0);
    
    // Hidden bias: Male candidates get a boost
    const biasedScore = isMale ? score + 0.15 : score;
    const hired = biasedScore > 0.45;
    
    return {
      id: `APP-${i}`,
      gender,
      race: ['White', 'Asian', 'Black', 'Hispanic'][Math.floor(Math.random() * 4)],
      years_experience: yearsExp,
      education: hasDegree ? 'Bachelors' : 'None',
      hired,
      score: biasedScore
    };
  });
};

const generateLoanData = (count: number): LoanApplicant[] => {
  return Array.from({ length: count }, (_, i) => {
    const isWhite = Math.random() > 0.4;
    const race = isWhite ? 'White' : 'Black';
    const income = Math.floor(Math.random() * 100000) + 20000;
    const credit = Math.floor(Math.random() * 500) + 300;
    
    let score = (income / 150000) + (credit / 1000);
    
    // Hidden bias: White applicants get a boost
    const biasedScore = isWhite ? score + 0.1 : score - 0.05;
    const approved = biasedScore > 0.6;
    
    return {
      id: `LOAN-${i}`,
      race,
      age: Math.floor(Math.random() * 50) + 20,
      income,
      credit_score: credit,
      approved,
      score: biasedScore
    };
  });
};

const generateHealthData = (count: number): Patient[] => {
  return Array.from({ length: count }, (_, i) => {
    const isMale = Math.random() > 0.5;
    const gender = isMale ? 'Male' : 'Female';
    const age = Math.floor(Math.random() * 60) + 18;
    const pain = Math.floor(Math.random() * 10);
    
    let score = (pain / 10) + (age > 50 ? 0.1 : 0);
    
    // Hidden bias: Men prioritized over women for same pain level
    const biasedScore = isMale ? score + 0.2 : score - 0.1;
    const treated_priority = biasedScore > 0.5;
    
    return {
      id: `PATIENT-${i}`,
      age,
      gender,
      pain_score: pain,
      wait_time: Math.floor(Math.random() * 120) + (gender === 'Female' && age > 50 ? 60 : 0),
      treated_priority,
      score: biasedScore
    };
  });
};

const generateAdmissionsData = (count: number) => {
  return Array.from({ length: count }, (_, i) => {
    const isLegacy = Math.random() > 0.8;
    const legacy = isLegacy ? 'Legacy' : 'Non-Legacy';
    const gpa = Math.random() * 2 + 2; // 2.0 to 4.0
    const sat = Math.floor(Math.random() * 800) + 800; // 800 to 1600
    
    let score = (gpa / 4) * 0.5 + (sat / 1600) * 0.5;
    
    // Bias: Legacy students get a boost
    const biasedScore = isLegacy ? score + 0.25 : score;
    const admitted = biasedScore > 0.7;
    
    return {
      id: `ADM-${i}`,
      legacy,
      gpa,
      sat,
      admitted,
      score: biasedScore
    };
  });
};

const generateModerationData = (count: number) => {
  return Array.from({ length: count }, (_, i) => {
    const isStandard = Math.random() > 0.3;
    const dialect = isStandard ? 'Standard' : 'AAVE';
    const toxicity_signal = Math.random();
    
    let score = 1 - toxicity_signal; // High score means safe
    
    // Bias: AAVE dialect posts are score lower (deemed less "safe" incorrectly)
    const biasedScore = isStandard ? score : Math.max(0, score - 0.3);
    const approved_post = biasedScore > 0.5;
    
    return {
      id: `MOD-${i}`,
      dialect,
      text_length: Math.floor(Math.random() * 200),
      approved_post,
      score: biasedScore
    };
  });
};

const generatePromotionData = (count: number) => {
  return Array.from({ length: count }, (_, i) => {
    const isMale = Math.random() > 0.5;
    const gender = isMale ? 'Male' : 'Female';
    const performance_rating = Math.floor(Math.random() * 5) + 1;
    const tenure = Math.floor(Math.random() * 10);
    
    let score = (performance_rating / 5) * 0.6 + (tenure / 10) * 0.4;
    
    // Bias: Men promoted more easily
    const biasedScore = isMale ? score + 0.1 : score - 0.1;
    const promoted = biasedScore > 0.6;
    
    return {
      id: `PROM-${i}`,
      gender,
      performance_rating,
      tenure,
      promoted,
      score: biasedScore
    };
  });
};

export const DATASETS: Dataset[] = [
  {
    id: 'hiring',
    name: 'Tech Hiring',
    description: 'Software Engineering candidates from a major tech hub.',
    icon: 'Briefcase',
    size: 1000,
    finding: 'Gender bias detected',
    protected_feature: 'gender',
    privileged_group: 'Male',
    unprivileged_group: 'Female',
    outcome_label: 'hired',
    data: generateHiringData(1000)
  },
  {
    id: 'loan',
    name: 'Loan Approval',
    description: 'Mortgage applications for first-time homebuyers.',
    icon: 'CreditCard',
    size: 2000,
    finding: 'Racial bias detected',
    protected_feature: 'race',
    privileged_group: 'White',
    unprivileged_group: 'Black',
    outcome_label: 'approved',
    data: generateLoanData(2000)
  },
  {
    id: 'health',
    name: 'Healthcare Triage',
    description: 'Emergency room priority assignment data.',
    icon: 'Stethoscope',
    size: 1500,
    finding: 'Gender & Age bias detected',
    protected_feature: 'gender',
    privileged_group: 'Male',
    unprivileged_group: 'Female',
    outcome_label: 'treated_priority',
    data: generateHealthData(1500)
  },
  {
    id: 'admissions',
    name: 'College Admissions',
    description: 'Admissions data for a top-tier university.',
    icon: 'GraduationCap',
    size: 2500,
    finding: 'Legacy bias detected',
    protected_feature: 'legacy',
    privileged_group: 'Legacy',
    unprivileged_group: 'Non-Legacy',
    outcome_label: 'admitted',
    data: generateAdmissionsData(2500)
  },
  {
    id: 'moderation',
    name: 'Content Moderation',
    description: 'Social media post flagging logs.',
    icon: 'MessageSquare',
    size: 5000,
    finding: 'Dialect bias detected',
    protected_feature: 'dialect',
    privileged_group: 'Standard',
    unprivileged_group: 'AAVE',
    outcome_label: 'approved_post',
    data: generateModerationData(5000)
  },
  {
    id: 'promotions',
    name: 'Employee Promotions',
    description: 'Internal promotion data for a global firm.',
    icon: 'TrendingUp',
    size: 1800,
    finding: 'Gender disparity detected',
    protected_feature: 'gender',
    privileged_group: 'Male',
    unprivileged_group: 'Female',
    outcome_label: 'promoted',
    data: generatePromotionData(1800)
  }
];
