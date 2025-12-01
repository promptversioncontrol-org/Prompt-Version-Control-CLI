import { scanTextForSensitiveData } from './risk-analysis/prompt-check';

const textToCheck = process.argv[2];

if (!textToCheck) {
  console.error('❌ Błąd: Nie podano tekstu do sprawdzenia.');
  console.log('Użycie: bun src/check-string.ts "Twój tekst do sprawdzenia"');
  process.exit(1);
}

console.log(`🔍 Sprawdzam tekst: "${textToCheck}"\n`);

const result = scanTextForSensitiveData(textToCheck, { source: 'prompt' });

if (result.hasSensitiveData) {
  console.log('⚠️  ZNALEZIONO WRAŻLIWE DANE:');
  console.log(JSON.stringify(result.findings, null, 2));
  console.log(`\nRisk Score: ${result.riskScore}`);
} else {
  console.log('✅ Nie znaleziono wrażliwych danych.');
}
