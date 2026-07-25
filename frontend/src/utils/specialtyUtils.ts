// client/src/utils/specialtyUtils.ts

export type SpecialtyCode = 'Cardiology' | 'Gastroenterology' | 'Diabetology' | 'Endocrinology' | 'General';

export interface SpecialtyTheme {
  primary: string;
  light: string;
  border: string;
  label: string;
}

export const SPECIALTY_THEMES: Record<SpecialtyCode, SpecialtyTheme> = {
  Cardiology: {
    primary: '#0d9488',
    light: '#f0fdfa',
    border: '#99f6e4',
    label: 'Cardiology Workspace'
  },
  Gastroenterology: {
    primary: '#0d9488',
    light: '#f0fdfa',
    border: '#99f6e4',
    label: 'Gastroenterology Workspace'
  },
  Diabetology: {
    primary: '#0d9488',
    light: '#f0fdfa',
    border: '#99f6e4',
    label: 'Diabetology Workspace'
  },
  Endocrinology: {
    primary: '#0d9488',
    light: '#f0fdfa',
    border: '#99f6e4',
    label: 'Endocrinology Workspace'
  },
  General: {
    primary: '#0d9488',
    light: '#f0fdfa',
    border: '#99f6e4',
    label: 'General Medicine Workspace'
  }
};

export function getSpecialtyCode(specialization: string | undefined): SpecialtyCode {
  if (!specialization) return 'General';
  const s = specialization.toLowerCase();
  if (s.includes('cardio')) return 'Cardiology';
  if (s.includes('gastro')) return 'Gastroenterology';
  if (s.includes('diabet')) return 'Diabetology';
  if (s.includes('endo')) return 'Endocrinology';
  return 'General';
}

export function getMedicineSpecialty(tc: string, name: string): SpecialtyCode {
  const tcLower = (tc || '').toLowerCase();
  const nameLower = (name || '').toLowerCase();

  // Cardiology Specialty
  if (
    tcLower.includes('anti-hypertensive') || tcLower.includes('antianginal') ||
    tcLower.includes('antiarrhythmic') || tcLower.includes('beta blocker') ||
    tcLower.includes('calcium channel blocker') || tcLower.includes('statin') ||
    tcLower.includes('cardio') || tcLower.includes('anticoagulant') ||
    tcLower.includes('platelet aggregation') || tcLower.includes('vasodilator') ||
    nameLower.includes('amlodipine') || nameLower.includes('atorvastatin') ||
    nameLower.includes('metoprolol') || nameLower.includes('telmisartan') ||
    nameLower.includes('clopidogrel') || nameLower.includes('aspirin') ||
    nameLower.includes('ramipril') || nameLower.includes('losartan') ||
    nameLower.includes('bisoprolol') || nameLower.includes('carvedilol') ||
    nameLower.includes('nebivolol') || nameLower.includes('rosuvastatin') ||
    nameLower.includes('simvastatin') || nameLower.includes('spironolactone') ||
    nameLower.includes('furosemide') || nameLower.includes('torsemide') ||
    nameLower.includes('enalapril') || nameLower.includes('lisinopril')
  ) {
    return 'Cardiology';
  }

  // Gastroenterology Specialty
  if (
    tcLower.includes('antacid') || tcLower.includes('anti-ulcer') ||
    tcLower.includes('ulcer') || tcLower.includes('proton pump inhibitor') ||
    tcLower.includes('h2 blocker') || tcLower.includes('antispasmodic') ||
    tcLower.includes('laxative') || tcLower.includes('antidiarrheals') ||
    tcLower.includes('hepatoprotective') || tcLower.includes('prokinetic') ||
    tcLower.includes('gastro') || tcLower.includes('antiemetic') ||
    nameLower.includes('pantoprazole') || nameLower.includes('omeprazole') ||
    nameLower.includes('rabeprazole') || nameLower.includes('domperidone') ||
    nameLower.includes('ranitidine') || nameLower.includes('famotidine') ||
    nameLower.includes('dicyclomine') || nameLower.includes('loperamide') ||
    nameLower.includes('sucralfate') || nameLower.includes('ondansetron') ||
    nameLower.includes('metoclopramide') || nameLower.includes('pantocid') ||
    nameLower.includes('keopan') || nameLower.includes('pan-') ||
    nameLower.includes('pan d') || nameLower.includes('pantodac') ||
    nameLower.includes('omee') || nameLower.includes('sucrafil') ||
    nameLower.includes('gutclear') || nameLower.includes('ganaton')
  ) {
    return 'Gastroenterology';
  }

  // Endocrinology / Diabetology Specialty
  if (
    tcLower.includes('anti-diabetic') || tcLower.includes('insulin') ||
    tcLower.includes('hypoglycemic') || tcLower.includes('thyroid') ||
    tcLower.includes('hormone') || tcLower.includes('endo') ||
    nameLower.includes('metformin') || nameLower.includes('glimepiride') ||
    nameLower.includes('gliclazide') || nameLower.includes('sitagliptin') ||
    nameLower.includes('vildagliptin') || nameLower.includes('empagliflozin') ||
    nameLower.includes('dapagliflozin') || nameLower.includes('pioglitazone') ||
    nameLower.includes('levothyroxine') || nameLower.includes('thyronorm') ||
    nameLower.includes('eltroxin') || nameLower.includes('carbimazole') ||
    nameLower.includes('glycomet') || nameLower.includes('januvia') ||
    nameLower.includes('galvus') || nameLower.includes('forxiga') ||
    nameLower.includes('jardiance') || nameLower.includes('human mixtard') ||
    nameLower.includes('novomix') || nameLower.includes('lantus')
  ) {
    return 'Endocrinology';
  }

  return 'General';
}

export interface PrescriptionTemplateMed {
  name: string;
  strength: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface PrescriptionTemplate {
  name: string;
  medicines: PrescriptionTemplateMed[];
  advice?: string;
  followUpDays?: number;
}

export const SPECIALTY_TEMPLATES: Record<SpecialtyCode, PrescriptionTemplate[]> = {
  Cardiology: [
    {
      name: 'Hypertension Management Pack',
      medicines: [
        { name: 'Telmisartan', strength: '40mg', dose: '1 tablet', frequency: 'Once daily', duration: '30 days', instructions: 'After meals' },
        { name: 'Amlodipine', strength: '5mg', dose: '1 tablet', frequency: 'Once daily', duration: '30 days', instructions: 'At bedtime' }
      ],
      advice: 'Monitor BP twice daily. Restrict salt intake and engage in 30 minutes of mild walking.',
      followUpDays: 30
    },
    {
      name: 'Post-Ischemic Stroke Regimen',
      medicines: [
        { name: 'Aspirin', strength: '75mg', dose: '1 tablet', frequency: 'Once daily', duration: '30 days', instructions: 'After meals' },
        { name: 'Clopidogrel', strength: '75mg', dose: '1 tablet', frequency: 'Once daily', duration: '30 days', instructions: 'After meals' },
        { name: 'Atorvastatin', strength: '20mg', dose: '1 tablet', frequency: 'Once daily', duration: '30 days', instructions: 'At bedtime' }
      ],
      advice: 'Take medicines regularly. Report any unusual bleeding or bruising immediately.',
      followUpDays: 30
    },
    {
      name: 'Chest Pain/Angina Protocol',
      medicines: [
        { name: 'Nitroglycerin', strength: '2.6mg', dose: '1 tablet', frequency: 'Twice daily', duration: '10 days', instructions: 'After meals' },
        { name: 'Metoprolol', strength: '25mg', dose: '1 tablet', frequency: 'Once daily', duration: '30 days', instructions: 'After meals' }
      ],
      advice: 'Sit down immediately if you need to take sublingual tablet for emergency chest pain. Avoid heavy physical lifting.',
      followUpDays: 14
    }
  ],
  Gastroenterology: [
    {
      name: 'GERD / Acid Reflux Protocol',
      medicines: [
        { name: 'Pantoprazole + Domperidone', strength: '40mg/30mg', dose: '1 capsule', frequency: 'Once daily', duration: '14 days', instructions: 'Before meals' },
        { name: 'Sucralfate Suspension', strength: '10ml', dose: '2 teaspoons', frequency: 'Thrice daily', duration: '7 days', instructions: 'Before meals' }
      ],
      advice: 'Avoid lying down for 2 hours after meals. Avoid spicy food, tea, and coffee.',
      followUpDays: 14
    },
    {
      name: 'Acute Gastritis Pack',
      medicines: [
        { name: 'Rabeprazole', strength: '20mg', dose: '1 tablet', frequency: 'Once daily', duration: '7 days', instructions: 'Before meals' },
        { name: 'Ondansetron', strength: '4mg', dose: '1 tablet', frequency: 'Thrice daily', duration: '3 days', instructions: 'As needed' }
      ],
      advice: 'Take bland, non-spicy diet. Drink coconut water and stay hydrated.',
      followUpDays: 7
    },
    {
      name: 'IBS Control Pack',
      medicines: [
        { name: 'Mebeverine', strength: '135mg', dose: '1 tablet', frequency: 'Thrice daily', duration: '15 days', instructions: 'Before meals' },
        { name: 'Chlordiazepoxide + Clidinium', strength: '5mg/2.5mg', dose: '1 tablet', frequency: 'Twice daily', duration: '10 days', instructions: 'Before meals' }
      ],
      advice: 'Follow a low-FODMAP diet. Manage stress levels and avoid carbonated drinks.',
      followUpDays: 15
    }
  ],
  Diabetology: [
    {
      name: 'Type 2 Diabetes Initial Pack',
      medicines: [
        { name: 'Metformin', strength: '500mg', dose: '1 tablet', frequency: 'Twice daily', duration: '30 days', instructions: 'After meals' },
        { name: 'Glimepiride', strength: '1mg', dose: '1 tablet', frequency: 'Once daily', duration: '30 days', instructions: 'Before meals' }
      ],
      advice: 'Perform regular fasting and post-prandial blood sugar tests. Restrict carbohydrate intake.',
      followUpDays: 30
    },
    {
      name: 'Diabetic Neuropathy Protocol',
      medicines: [
        { name: 'Pregabalin + Methylcobalamin', strength: '75mg/1500mcg', dose: '1 capsule', frequency: 'Once daily', duration: '30 days', instructions: 'At bedtime' }
      ],
      advice: 'Keep feet clean and dry. Check feet daily for any cuts or ulcers.',
      followUpDays: 30
    },
    {
      name: 'Intensive Insulin Regimen',
      medicines: [
        { name: 'Insulin Glargine (Lantus)', strength: '100 IU/ml', dose: '10 units', frequency: 'Once daily', duration: 'Ongoing', instructions: 'At bedtime' },
        { name: 'Metformin', strength: '1000mg', dose: '1 tablet', frequency: 'Twice daily', duration: '30 days', instructions: 'After meals' }
      ],
      advice: 'Inject insulin subcutaneously as instructed. Keep sugar cubes handy in case of hypoglycemic symptoms.',
      followUpDays: 15
    }
  ],
  Endocrinology: [
    {
      name: 'Hypothyroidism (Levothyroxine) Protocol',
      medicines: [
        { name: 'Levothyroxine (Thyronorm)', strength: '50mcg', dose: '1 tablet', frequency: 'Once daily', duration: 'Ongoing', instructions: 'Empty stomach' }
      ],
      advice: 'Take medicine first thing in the morning with plain water. Wait 45 minutes before eating or drinking tea/coffee.',
      followUpDays: 60
    },
    {
      name: 'Thyroiditis Management Set',
      medicines: [
        { name: 'Prednisolone', strength: '10mg', dose: '1 tablet', frequency: 'Once daily', duration: '7 days', instructions: 'After meals' },
        { name: 'Propranolol', strength: '10mg', dose: '1 tablet', frequency: 'Twice daily', duration: '15 days', instructions: 'After meals' }
      ],
      advice: 'Taper steroid dose only as directed by the physician. Monitor heart rate.',
      followUpDays: 10
    },
    {
      name: 'Obesity/Weight Control Pack',
      medicines: [
        { name: 'Orlistat', strength: '120mg', dose: '1 capsule', frequency: 'Thrice daily', duration: '30 days', instructions: 'With meals' }
      ],
      advice: 'Follow a low-fat diet. Participate in regular cardiovascular exercise.',
      followUpDays: 30
    }
  ],
  General: [
    {
      name: 'Acute Viral Fever Regimen',
      medicines: [
        { name: 'Paracetamol', strength: '650mg', dose: '1 tablet', frequency: 'Thrice daily', duration: '5 days', instructions: 'After meals' },
        { name: 'Multivitamin', strength: 'Standard', dose: '1 tablet', frequency: 'Once daily', duration: '10 days', instructions: 'After meals' }
      ],
      advice: 'Take plenty of fluids and rest. Check temperature every 6 hours.',
      followUpDays: 5
    },
    {
      name: 'Migraine Treatment Set',
      medicines: [
        { name: 'Naproxen + Domperidone', strength: '500mg/10mg', dose: '1 tablet', frequency: 'Twice daily', duration: '5 days', instructions: 'After meals' }
      ],
      advice: 'Rest in a quiet, dark room during migraine episodes. Avoid known triggers like bright light or loud noise.',
      followUpDays: 7
    },
    {
      name: 'URTI / Cough & Cold Pack',
      medicines: [
        { name: 'Amoxicillin', strength: '500mg', dose: '1 tablet', frequency: 'Thrice daily', duration: '5 days', instructions: 'After meals' },
        { name: 'Levocetirizine', strength: '5mg', dose: '1 tablet', frequency: 'Once daily', duration: '5 days', instructions: 'At bedtime' }
      ],
      advice: 'Complete the entire course of antibiotics. Avoid cold water and beverages.',
      followUpDays: 5
    }
  ]
};
