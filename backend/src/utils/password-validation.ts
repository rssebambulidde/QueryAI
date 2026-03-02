export interface PasswordStrengthResult {
  isValid: boolean;
  score: number; // 0-4
  label: 'weak' | 'fair' | 'good' | 'strong';
  errors: string[];
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456', '1234567', '12345678',
  '123456789', '1234567890', 'qwerty', 'qwerty123', 'abc123', 'monkey',
  'master', 'dragon', 'login', 'princess', 'football', 'shadow', 'sunshine',
  'trustno1', 'iloveyou', 'batman', 'letmein', 'access', 'hello', 'charlie',
  'donald', '123123', '654321', 'baseball', 'michael', 'ashley', 'thomas',
  'superman', 'summer', 'welcome', 'welcome1', 'admin', 'passw0rd',
  'starwars', 'whatever', 'qazwsx', 'mustang', 'freedom', 'nothing',
  'master1', 'killer', 'jordan', 'jennifer', 'hunter', 'amanda', 'joshua',
  'test', 'test123', 'pass', 'pass123', 'changeme', 'secret', 'god',
  'computer', 'internet', 'soccer', 'hockey', 'ranger', 'buster',
  'pepper', 'ginger', 'george', 'robert', 'matrix', 'corvette',
  'austin', 'mercedes', 'thunder', 'andrea', 'hammer', 'yankees',
]);

export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const errors: string[] = [];
  let score = 0;

  if (password.length < 8) {
    errors.push('At least 8 characters');
  } else {
    score++;
  }

  if (!/[a-z]/.test(password)) {
    errors.push('At least one lowercase letter');
  } else {
    score++;
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('At least one uppercase letter');
  } else {
    score++;
  }

  if (!/[0-9]/.test(password)) {
    errors.push('At least one number');
  } else {
    score++;
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('At least one special character');
  } else {
    score++;
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('This password is too common');
    score = 0;
  }

  const labels: Record<number, 'weak' | 'fair' | 'good' | 'strong'> = {
    0: 'weak', 1: 'weak', 2: 'fair', 3: 'good', 4: 'strong', 5: 'strong',
  };

  return {
    isValid: errors.length === 0,
    score: Math.min(score, 4),
    label: labels[score] || 'weak',
    errors,
  };
}
