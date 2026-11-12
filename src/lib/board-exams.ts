/**
 * Board Exam Definitions for Philippine Licensure Examinations
 *
 * This is the single source of truth for:
 * - Which courses map to which board exam
 * - Subject breakdowns with official weight percentages
 * - Exam schedules and passing rates
 *
 * Used by: readiness dashboard, simulated exam generator, AI tutor context,
 * course picker auto-mapping, landing page marketing.
 */

export interface BoardSubject {
  /** Short code used internally (e.g., "GENED", "PROFED", "STRUCT") */
  code: string;
  /** Display name shown to students */
  name: string;
  /** Percentage weight in the board exam (sums to 100 per exam) */
  weight: number;
  /** Human-readable description of topics covered */
  description: string;
  /** Optional: more granular topics for tagging questions */
  topics?: string[];
}

export interface BoardExam {
  /** Unique code: "BLEPT", "NLE", "CELE", "MLE", "RADTECH", "CRIM", "CPA" */
  code: string;
  /** Full official name */
  name: string;
  /** Programs that take this exam (must match src/lib/courses.ts program names exactly) */
  courses: string[];
  /** When the exam is given (e.g., "March & September") */
  schedule: string;
  /** Typical passing rate range (informational) */
  passingRate: string;
  /** Minimum passing grade (usually 75% general average, no subject below 50-60%) */
  passingGrade: string;
  /** Subject breakdown with weights */
  subjects: BoardSubject[];
  /** Total number of questions in the actual exam (for simulation) */
  totalQuestions: number;
  /** Total time in minutes (for simulation timer) */
  totalMinutes: number;
  /** Brief tagline for marketing */
  tagline: string;
}

/** All supported board exams — add new ones here as needed. */
export const BOARD_EXAMS: BoardExam[] = [
  {
    code: "BLEPT",
    name: "Board Licensure Examination for Professional Teachers",
    courses: [
      "BS Secondary Education",
      "BS Elementary Education",
    ],
    schedule: "March & September",
    passingRate: "35–40%",
    passingGrade: "75% general average, no subject below 50%",
    totalQuestions: 200,
    totalMinutes: 240, // 4 hours
    tagline: "Your path to becoming a Licensed Professional Teacher",
    subjects: [
      {
        code: "GENED",
        name: "General Education",
        weight: 20,
        description: "English, Filipino, Mathematics, Science, Social Studies/Philosophy",
        topics: [
          "English (Communication Arts, Literature)",
          "Filipino (Komunikasyon, Panitikan)",
          "Mathematics (Algebra, Geometry, Statistics)",
          "Natural Science (Biology, Chemistry, Physics, Earth Science)",
          "Social Sciences (History, Economics, Politics, Philosophy)",
        ],
      },
      {
        code: "PROFED",
        name: "Professional Education",
        weight: 40,
        description: "Principles of Teaching, Assessment, Curriculum, Child Development, Technology",
        topics: [
          "Principles & Theories of Learning (Behaviorism, Cognitivism, Constructivism)",
          "Teaching Strategies & Methods",
          "Measurement & Evaluation (Assessment of/for/as Learning)",
          "Curriculum Development",
          "Child & Adolescent Development",
          "Educational Technology",
          "The Teaching Profession (Code of Ethics, Legal Bases)",
          "Classroom Management",
          "Inclusive Education",
        ],
      },
      {
        code: "MAJOR",
        name: "Specialization / Major",
        weight: 40,
        description: "Content specific to your major (English, Math, Science, Social Studies, Filipino, MAPEH, TLE, Values)",
        topics: [
          "English: Linguistics, Literature, Language Teaching",
          "Mathematics: Advanced Algebra, Calculus, Statistics, Math Teaching",
          "Science: Biology, Chemistry, Physics, Earth Science, Science Teaching",
          "Social Studies: History, Geography, Economics, Political Science, SocSci Teaching",
          "Filipino: Wika, Panitikan, Pagtuturo ng Filipino",
          "MAPEH: Music, Arts, PE, Health",
          "TLE: Home Economics, Industrial Arts, Agri-Fishery, ICT",
          "Values Education: Ethics, Philosophy, Values Teaching",
        ],
      },
    ],
  },
  {
    code: "NLE",
    name: "Nurse Licensure Examination",
    courses: [
      "BS Nursing",
    ],
    schedule: "June & December",
    passingRate: "40–50%",
    passingGrade: "75% general average, no subject below 60%",
    totalQuestions: 500, // 100 per subject × 5
    totalMinutes: 480, // 8 hours (2 days × 4 hours)
    tagline: "Your journey to becoming a Registered Nurse",
    subjects: [
      {
        code: "NURS1",
        name: "Nursing Practice I",
        weight: 20,
        description: "Fundamentals of Nursing, Health Assessment, Nutrition, Pharmacology basics",
        topics: [
          "Nursing Process & Critical Thinking",
          "Health Assessment (Physical, Psychosocial)",
          "Fundamental Nursing Skills",
          "Nutrition & Diet Therapy",
          "Basic Pharmacology",
          "Infection Control & Asepsis",
        ],
      },
      {
        code: "NURS2",
        name: "Nursing Practice II",
        weight: 20,
        description: "Maternal & Child Health Nursing, Community Health Nursing",
        topics: [
          "Maternal Nursing (Antepartal, Intrapartal, Postpartal)",
          "Newborn & Neonatal Care",
          "Pediatric Nursing (Growth & Development, Common Illnesses)",
          "Community Health Nursing (CHN Process, Programs)",
          "Family Health Nursing",
        ],
      },
      {
        code: "NURS3",
        name: "Nursing Practice III",
        weight: 20,
        description: "Medical-Surgical Nursing I & II (Adult Health)",
        topics: [
          "Respiratory, Cardiovascular, Gastrointestinal Systems",
          "Neurological, Endocrine, Renal/Urinary Systems",
          "Perioperative Nursing",
          "Emergency & Disaster Nursing",
          "Oncology, Immunologic, Musculoskeletal Disorders",
        ],
      },
      {
        code: "NURS4",
        name: "Nursing Practice IV",
        weight: 20,
        description: "Psychiatric Nursing, Community Health Nursing II, Leadership",
        topics: [
          "Psychiatric-Mental Health Nursing",
          "Community Health Nursing (Advanced)",
          "Nursing Leadership & Management",
          "Quality Improvement & Patient Safety",
          "Research in Nursing",
        ],
      },
      {
        code: "NURS5",
        name: "Nursing Practice V",
        weight: 20,
        description: "Comprehensive Review / Integrated Nursing Practice",
        topics: [
          "Integrated Clinical Scenarios",
          "Prioritization & Delegation",
          "Ethical-Legal Issues",
          "Cultural Competence",
          "Disaster & Emergency Preparedness",
        ],
      },
    ],
  },
  {
    code: "CELE",
    name: "Civil Engineering Licensure Examination",
    courses: [
      "BS Civil Engineering",
    ],
    schedule: "May & November",
    passingRate: "35–45%",
    passingGrade: "70% general average, no subject below 50%",
    totalQuestions: 300, // approx
    totalMinutes: 480, // 2 days
    tagline: "Build the future — pass the CE Board Exam",
    subjects: [
      {
        code: "MATH",
        name: "Mathematics",
        weight: 15,
        description: "Algebra, Trigonometry, Analytic Geometry, Calculus, Differential Equations, Probability & Statistics",
        topics: [
          "College Algebra & Advanced Algebra",
          "Plane & Spherical Trigonometry",
          "Analytic Geometry",
          "Differential & Integral Calculus",
          "Differential Equations",
          "Probability & Statistics",
          "Engineering Economics (Math portion)",
        ],
      },
      {
        code: "SURV",
        name: "Surveying",
        weight: 15,
        description: "Plane Surveying, Topographic Surveying, Hydrographic Surveying, GPS/GNSS",
        topics: [
          "Plane Surveying (Taping, Leveling, Transit/Theodolite)",
          "Topographic Surveying (Contouring, Cross-section)",
          "Hydrographic Surveying",
          "GPS/GNSS & Remote Sensing",
          "Curve Surveying (Simple, Compound, Reverse, Spiral)",
          "Earthwork Computations",
        ],
      },
      {
        code: "HYDRO",
        name: "Hydraulics & Geotechnical Engineering",
        weight: 20,
        description: "Fluid Mechanics, Hydrology, Hydraulics, Soil Mechanics, Foundations",
        topics: [
          "Fluid Properties & Statics",
          "Fluid Flow (Pipe, Open Channel)",
          "Hydrology (Precipitation, Runoff, Flood Analysis)",
          "Hydraulic Structures",
          "Soil Mechanics (Properties, Classification, Compaction)",
          "Soil Bearing Capacity & Settlement",
          "Shallow & Deep Foundations",
          "Lateral Earth Pressure & Retaining Walls",
          "Slope Stability",
        ],
      },
      {
        code: "STRUCT",
        name: "Structural Engineering & Design",
        weight: 25,
        description: "Structural Analysis, Concrete Design, Steel Design, Timber Design, Seismic Design, Prestressed Concrete",
        topics: [
          "Structural Analysis (Determinate, Indeterminate, Matrix Methods)",
          "Reinforced Concrete Design (NSCP/ACI)",
          "Steel Design (NSCP/AISC)",
          "Timber Design (NSCP/NDS)",
          "Seismic Design (NSCP/ASCE 7)",
          "Wind Load Design",
          "Prestressed Concrete",
          "Bridge Design Basics",
        ],
      },
      {
        code: "TRANS",
        name: "Transportation & Construction Engineering",
        weight: 15,
        description: "Highway Engineering, Traffic Engineering, Railway, Airport, Project Management, Construction Methods",
        topics: [
          "Highway Geometric Design",
          "Pavement Design (Flexible, Rigid)",
          "Traffic Engineering & Management",
          "Railway & Airport Engineering",
          "Construction Project Management (CPM, PERT)",
          "Construction Methods & Equipment",
          "Construction Safety",
          "Contracts & Specifications",
        ],
      },
      {
        code: "ENV",
        name: "Environmental & Water Resources Engineering",
        weight: 10,
        description: "Water Supply, Wastewater, Solid Waste, Air Pollution, Environmental Impact Assessment",
        topics: [
          "Water Supply Engineering (Sources, Treatment, Distribution)",
          "Wastewater Engineering (Collection, Treatment, Disposal)",
          "Solid & Hazardous Waste Management",
          "Air Pollution Control",
          "Environmental Impact Assessment (EIA)",
          "Water Resources Planning",
        ],
      },
    ],
  },
  {
    code: "MLE",
    name: "Medical Technology Licensure Examination",
    courses: [
      "BS Medical Technology",
    ],
    schedule: "March & August",
    passingRate: "50–60%",
    passingGrade: "75% general average, no subject below 50%",
    totalQuestions: 600, // 100 per subject × 6
    totalMinutes: 480, // 2 days
    tagline: "Diagnose your way to the MT License",
    subjects: [
      {
        code: "CLINCHEM",
        name: "Clinical Chemistry",
        weight: 20,
        description: "Carbohydrates, Lipids, Proteins, Enzymes, Electrolytes, Acid-Base, Toxicology, Endocrinology, Instrumentation",
        topics: [
          "Carbohydrate Metabolism (Glucose, HbA1c)",
          "Lipid Metabolism (Cholesterol, Triglycerides, Lipoproteins)",
          "Proteins & Enzymes (Liver, Cardiac, Pancreatic)",
          "Electrolytes & Acid-Base Balance",
          "Renal Function (BUN, Creatinine, Uric Acid)",
          "Endocrinology (Thyroid, Adrenal, Reproductive Hormones)",
          "Therapeutic Drug Monitoring & Toxicology",
          "Instrumentation & Quality Control",
        ],
      },
      {
        code: "HEMATO",
        name: "Hematology",
        weight: 15,
        description: "Blood Cell Morphology, Anemias, Leukemias, Coagulation, Hemostasis, Blood Banking basics",
        topics: [
          "Hematopoiesis & Blood Cell Morphology",
          "Anemias (Microcytic, Normocytic, Macrocytic)",
          "Leukemias & Lymphomas",
          "Myeloproliferative & Lymphoproliferative Disorders",
          "Coagulation & Hemostasis (PT, aPTT, Fibrinogen)",
          "Platelet Disorders",
          "Automated Hematology Analyzers",
          "Body Fluid Analysis",
        ],
      },
      {
        code: "MICRO",
        name: "Clinical Microbiology",
        weight: 20,
        description: "Bacteriology, Mycology, Parasitology, Virology, Antimicrobial Susceptibility, Infection Control",
        topics: [
          "Gram-Positive & Gram-Negative Bacteria",
          "Anaerobes, Mycobacteria, Spirochetes",
          "Fungi (Yeasts, Molds, Dimorphic)",
          "Parasites (Protozoa, Helminths, Arthropods)",
          "Viruses (Common Viral Pathogens)",
          "Antimicrobial Susceptibility Testing (Kirby-Bauer, MIC)",
          "Healthcare-Associated Infections",
          "Specimen Collection & Transport",
        ],
      },
      {
        code: "IMMUNO",
        name: "Immunology & Serology",
        weight: 15,
        description: "Immune Response, Hypersensitivity, Autoimmunity, Transplant, Tumor Immunology, Serologic Tests",
        topics: [
          "Innate & Adaptive Immunity",
          "Immunoglobulins & Complement",
          "Hypersensitivity Reactions (I–IV)",
          "Autoimmune Diseases (SLE, RA, etc.)",
          "Transplant & Tumor Immunology",
          "Serologic Tests (VDRL, ASO, RF, ANA, Hepatitis, HIV)",
          "Flow Cytometry & Immunophenotyping",
        ],
      },
      {
        code: "BLOODBANK",
        name: "Blood Banking / Immunohematology",
        weight: 10,
        description: "ABO/Rh Systems, Compatibility Testing, Blood Components, Transfusion Reactions, Donor Screening",
        topics: [
          "ABO & Rh Blood Group Systems",
          "Other Blood Group Systems (Kell, Duffy, Kidd, MNS)",
          "Antibody Screening & Identification",
          "Compatibility Testing (Crossmatch)",
          "Blood Components (RBC, FFP, Platelets, Cryo)",
          "Transfusion Reactions & Hemolytic Disease",
          "Donor Selection & Blood Collection",
          "Apheresis & Special Products",
        ],
      },
      {
        code: "PARASITO",
        name: "Parasitology",
        weight: 10,
        description: "Protozoa, Helminths (Nematodes, Cestodes, Trematodes), Arthropods, Diagnostic Methods",
        topics: [
          "Intestinal & Blood Protozoa",
          "Nematodes (Roundworms)",
          "Cestodes (Tapeworms)",
          "Trematodes (Flukes)",
          "Arthropod Vectors",
          "Microscopic Identification (Ova, Cysts, Larvae)",
          "Concentration Techniques",
        ],
      },
      {
        code: "HISTO",
        name: "Histopathology / Histotechniques",
        weight: 10,
        description: "Tissue Processing, Staining (H&E, Special), Frozen Section, Cytology Basics, Laboratory Management",
        topics: [
          "Tissue Fixation & Processing",
          "Microtomy & Sectioning",
          "H&E Staining",
          "Special Stains (Microorganisms, Carbohydrates, Lipids, Amyloid, Connective Tissue)",
          "Frozen Section & Cryostat",
          "Cytology (Pap Smear, FNAB, Body Fluids)",
          "Immunohistochemistry Basics",
          "Laboratory Safety & Quality Management",
        ],
      },
    ],
  },
  {
    code: "RADTECH",
    name: "Radiologic Technology Licensure Examination",
    courses: [
      "BS Radiologic Technology",
    ],
    schedule: "June & December",
    passingRate: "40–50%",
    passingGrade: "75% general average, no subject below 60%",
    totalQuestions: 400, // approx
    totalMinutes: 480, // 2 days
    tagline: "Image your success — pass the RadTech Boards",
    subjects: [
      {
        code: "RADPHYS",
        name: "Radiation Physics & Equipment",
        weight: 20,
        description: "Atomic Structure, X-Ray Production, X-Ray Circuit, Generators, Digital Imaging, Quality Control",
        topics: [
          "Atomic Structure & Electromagnetic Radiation",
          "X-Ray Production & Interactions with Matter",
          "X-Ray Tube & Circuitry",
          "Generators & Exposure Factors (kVp, mA, Time)",
          "Digital Radiography (CR, DR, PACS)",
          "Fluoroscopy & Image Intensifiers",
          "Computed Tomography Physics",
          "MRI Physics Basics",
          "Radiation Detection & Measurement",
        ],
      },
      {
        code: "RADPROT",
        name: "Radiation Protection & Biology",
        weight: 15,
        description: "Radiation Units, Dose Limits, Shielding, Monitoring, Radiobiology, Patient Protection",
        topics: [
          "Radiation Quantities & Units (Gy, Sv, rem, rad)",
          "Dose Limits (Occupational, Public, Patient)",
          "Shielding Design (Lead, Concrete, TVL/HVL)",
          "Personnel Monitoring (TLD, OSL, Film Badge)",
          "Radiobiology (Cell Effects, Stochastic/Deterministic)",
          "Patient Protection (ALARA, Gonadal Shielding)",
          "Regulatory Agencies (PNRI, IAEA, ICRP)",
        ],
      },
      {
        code: "RADPOS",
        name: "Radiographic Positioning & Procedures",
        weight: 25,
        description: "Routine & Special Positioning (Skull, Spine, Chest, Abdomen, Extremities), Contrast Studies, Pediatric, Geriatric",
        topics: [
          "Chest & Thorax (PA, AP, Lateral, Lordotic, Decubitus)",
          "Upper & Lower Extremities",
          "Spine (Cervical, Thoracic, Lumbar, Sacrum, Coccyx)",
          "Skull & Facial Bones",
          "Abdominal Radiography",
          "Contrast Studies (GI, GU, Biliary, Vascular)",
          "Pediatric & Geriatric Positioning",
          "Trauma & Mobile Radiography",
          "Surgical & C-Arm Radiography",
        ],
      },
      {
        code: "RADPATH",
        name: "Radiographic Pathology",
        weight: 15,
        description: "Respiratory, Cardiovascular, GI, GU, Musculoskeletal, Neurologic, Neoplastic, Congenital Pathologies on Imaging",
        topics: [
          "Respiratory Pathologies (Pneumonia, TB, CA, Effusion)",
          "Cardiovascular Pathologies (CHD, CHF, Aneurysm)",
          "GI Pathologies (Obstruction, Perforation, Masses)",
          "GU Pathologies (Stones, Tumors, Hydronephrosis)",
          "Musculoskeletal (Fractures, Dislocations, Arthritis, Tumors)",
          "Neurologic (Stroke, Hemorrhage, Tumors)",
          "Neoplastic Processes (Benign vs Malignant)",
          "Congenital & Developmental Anomalies",
        ],
      },
      {
        code: "RADQC",
        name: "Quality Control & Equipment Maintenance",
        weight: 15,
        description: "QC Tests (Resolution, Linearity, Accuracy), Preventive Maintenance, Troubleshooting, DICOM/PACS, Acceptance Testing",
        topics: [
          "QC for X-Ray, Fluoro, Mobile, Dental Units",
          "QC for CR/DR Systems",
          "QC for CT, MRI, Mammography",
          "Preventive Maintenance Schedules",
          "Troubleshooting Common Artifacts",
          "DICOM, PACS, RIS/HIS Integration",
          "Acceptance Testing New Equipment",
        ],
      },
      {
        code: "PATIENT",
        name: "Patient Care & Management",
        weight: 10,
        description: "Communication, Vital Signs, Infection Control, Contrast Reactions, Ethics, Legal, Department Management",
        topics: [
          "Patient Communication & Education",
          "Vital Signs Assessment",
          "Infection Control & Aseptic Technique",
          "Contrast Media Types & Reactions",
          "Emergency Procedures (CPR, Codes)",
          "Medical Ethics & Patient Rights",
          "Legal Responsibilities (Consent, Documentation)",
          "Radiology Department Management",
        ],
      },
    ],
  },
  {
    code: "CRIM",
    name: "Criminology Licensure Examination",
    courses: [
      "BS Criminology",
    ],
    schedule: "June & December",
    passingRate: "30–40%",
    passingGrade: "75% general average, no subject below 50%",
    totalQuestions: 400, // approx
    totalMinutes: 480, // 2 days
    tagline: "Enforce justice — ace the Criminology Boards",
    subjects: [
      {
        code: "CRIM1",
        name: "Criminal Law & Jurisprudence (Book 1 & 2 RPC, Special Laws)",
        weight: 20,
        description: "Revised Penal Code (Books 1 & 2), Special Penal Laws, Jurisprudence, Criminal Procedure",
        topics: [
          "RPC Book 1: General Principles, Felonies, Circumstances, Penalties",
          "RPC Book 2: Crimes vs National Security, Public Interest, Persons, Property, Chastity",
          "Special Laws (RA 9165, 9262, 10175, 10591, etc.)",
          "Criminal Procedure (Rules 110–127)",
          "Evidence (Rules 128–134)",
          "Supreme Court Jurisprudence (Landmark Cases)",
        ],
      },
      {
        code: "CRIM2",
        name: "Law Enforcement Administration",
        weight: 15,
        description: "Police Organization, Administration, Operations, Planning, Personnel, Budget, Logistics",
        topics: [
          "Police Organization & Administration (RA 6975, 8551, 9708)",
          "Police Planning & Operations",
          "Police Personnel & Records Management",
          "Police Budget & Logistics",
          "Police-Community Relations",
          "Comparative Police Systems",
        ],
      },
      {
        code: "CRIM3",
        name: "Crime Detection & Investigation",
        weight: 20,
        description: "Criminal Investigation, Forensic Science, Crime Scene, Interview/Interrogation, Surveillance",
        topics: [
          "Fundamentals of Criminal Investigation",
          "Crime Scene Management & Processing",
          "Forensic Science (Fingerprints, DNA, Ballistics, Questioned Documents)",
          "Interview & Interrogation Techniques",
          "Surveillance & Undercover Operations",
          "Case Preparation & Court Testimony",
          "Special Crime Investigation (Drugs, Cybercrime, Arson, Bombing)",
        ],
      },
      {
        code: "CRIM4",
        name: "Correctional Administration",
        weight: 15,
        description: "Jail/Bureau of Corrections, Inmate Classification, Rehabilitation, Probation, Parole, Restorative Justice",
        topics: [
          "History & Philosophy of Corrections",
          "Bureau of Corrections & BJMP (RA 10575)",
          "Inmate Classification & Treatment",
          "Rehabilitation Programs (Education, Livelihood, Spiritual)",
          "Probation (PD 968) & Parole (RA 4103)",
          "Restorative Justice & Therapeutic Community",
          "International Standards (Nelson Mandela Rules)",
        ],
      },
      {
        code: "CRIM5",
        name: "Criminology & Sociology of Crimes",
        weight: 15,
        description: "Criminological Theories, Crime Causation, Victimology, Juvenile Delinquency, White-Collar Crime, Organized Crime",
        topics: [
          "Classical, Positivist, Chicago School Theories",
          "Biological, Psychological, Sociological Causation",
          "Victimology & Victim Assistance",
          "Juvenile Delinquency (RA 9344, 10630)",
          "White-Collar & Corporate Crime",
          "Organized Crime & Transnational Crime",
          "Terrorism & Violent Extremism",
        ],
      },
      {
        code: "CRIM6",
        name: "Forensic Science & Criminalistics",
        weight: 15,
        description: "Physical Evidence, Crime Lab, DNA, Fingerprints, Ballistics, Toxicology, Digital Forensics",
        topics: [
          "Crime Laboratory Organization (PNP Crime Lab, NBI)",
          "Physical Evidence Collection & Preservation",
          "Forensic Biology & DNA Analysis",
          "Fingerprint Science (AFIS, Poroscopy, Edgeoscopy)",
          "Forensic Ballistics & Toolmarks",
          "Forensic Toxicology (Drugs, Alcohol, Poisons)",
          "Questioned Documents Examination",
          "Digital & Cyber Forensics",
          "Forensic Photography & Imaging",
        ],
      },
    ],
  },
  {
    code: "CPA",
    name: "Certified Public Accountant Licensure Examination",
    courses: [
      "BS Accountancy",
    ],
    schedule: "May & October",
    passingRate: "15–25%",
    passingGrade: "75% general average, no subject below 60% (some sittings 50%)",
    totalQuestions: 400, // 100 per subject × 4 (varies by year)
    totalMinutes: 480, // 2 days
    tagline: "Balance your way to the CPA title",
    subjects: [
      {
        code: "FINACC",
        name: "Financial Accounting & Reporting",
        weight: 25,
        description: "PFRS/PAS, Conceptual Framework, Financial Statements, Revenue, Assets, Liabilities, Equity, Leases, Errors",
        topics: [
          "Conceptual Framework (IASB/PFRS)",
          "Presentation of Financial Statements (PAS 1)",
          "Inventories (PAS 2), Property/Plant/Equipment (PAS 16)",
          "Intangible Assets (PAS 38), Impairment (PAS 36)",
          "Leases (PFRS 16), Revenue (PFRS 15)",
          "Financial Instruments (PFRS 9), Fair Value (PFRS 13)",
          "Provisions, Contingencies (PAS 37), Events After Reporting (PAS 10)",
          "Accounting Changes & Errors (PAS 8)",
          "Statement of Cash Flows (PAS 7)",
          "Consolidated & Separate Financial Statements (PFRS 10, PAS 27)",
          "Business Combinations (PFRS 3), Joint Arrangements (PFRS 11)",
          "Disclosure Standards (PAS 24, PFRS 7, PFRS 12)",
        ],
      },
      {
        code: "ADVACC",
        name: "Advanced Accounting",
        weight: 15,
        description: "Partnerships, Corporations, Consolidations, Foreign Currency, Segment Reporting, Government/NGO Accounting",
        topics: [
          "Partnership Accounting (Formation, Operations, Dissolution, Liquidation)",
          "Corporate Accounting (Formation, Stock Transactions, Retained Earnings)",
          "Consolidated Financial Statements (Control, NCI, Goodwill, Intercompany)",
          "Foreign Currency Transactions & Translation (PAS 21)",
          "Segment Reporting (PFRS 8)",
          "Government Accounting (NGAS, PPSAS)",
          "Non-Profit / NGO Accounting",
          "Special Topics (Insolvency, Liquidation, Build-Operate-Transfer)",
        ],
      },
      {
        code: "AUDIT",
        name: "Auditing & Assurance",
        weight: 20,
        description: "PSA/ISA, Audit Process, Risk Assessment, Evidence, Internal Control, Sampling, Reports, Ethics, Quality Control",
        topics: [
          "Audit Framework (PSA 200, 210, 220, 230, 240, 250, 260, 265)",
          "Risk Assessment & Materiality (PSA 315, 320, 330)",
          "Audit Evidence (PSA 500, 501, 505, 510, 520, 530, 540, 550, 560, 570, 580)",
          "Internal Control & Control Risk (PSA 315, 330)",
          "Audit Sampling (PSA 530)",
          "Substantive Procedures (Revenue, Purchases, Inventory, Cash, etc.)",
          "Completion & Reporting (PSA 700, 701, 705, 706, 710, 720)",
          "Code of Ethics (IESBA/BOA Resolution)",
          "Quality Control (PSQC 1, ISA 220)",
          "Special Engagements (Review, Compilation, Agreed-Upon Procedures)",
        ],
      },
      {
        code: "MANCON",
        name: "Management Advisory Services",
        weight: 15,
        description: "Strategic Management, Decision Analysis, CVP, Budgeting, Standard Costing, Variance, Capital Budgeting, Working Capital, IT",
        topics: [
          "Strategic Planning & Management",
          "Cost Concepts & Classifications",
          "CVP Analysis & Break-Even",
          "Job Order & Process Costing",
          "Activity-Based Costing (ABC)",
          "Standard Costing & Variance Analysis",
          "Budgeting (Master, Flexible, Zero-Based)",
          "Responsibility Accounting & Transfer Pricing",
          "Capital Budgeting (NPV, IRR, Payback, ARR)",
          "Working Capital Management (Cash, Receivables, Inventory)",
          "Financial Statement Analysis (Ratios, Cash Flow, DuPont)",
          "Decision Making (Relevant Costs, Make/Buy, Special Orders)",
          "Management Information Systems & IT Governance",
        ],
      },
      {
        code: "TAX",
        name: "Taxation",
        weight: 15,
        description: "NIRC (Income, Transfer, VAT, Percentage, Excise, Documentary), Tax Remedies, Local Taxation, Jurisprudence",
        topics: [
          "General Principles & Tax Administration",
          "Income Taxation (Individuals, Corporations, Passive Income, Fringe Benefits)",
          "Estate & Donor's Tax",
          "Value-Added Tax (VAT)",
          "Percentage Tax & Excise Tax",
          "Documentary Stamp Tax",
          "Tax Remedies (Administrative, Judicial)",
          "Local Taxation (LGC)",
          "Tax Treaties & International Taxation",
          "BIR Rulings & Supreme Court Tax Jurisprudence",
        ],
      },
      {
        code: "REG",
        name: "Regulatory Framework for Business Transactions",
        weight: 10,
        description: "Obligations & Contracts, Agency, Partnership, Corporation, Sales, Credit Transactions, Labor Law, Commercial Law",
        topics: [
          "Law on Obligations & Contracts",
          "Agency, Partnership, Corporation Code (RA 11232)",
          "Sales (Civil Code), Credit Transactions (Pledge, Mortgage, Guaranty)",
          "Negotiable Instruments Law (Act 2031)",
          "Insurance Code (RA 10607)",
          "Transportation Law",
          "Labor Law (Labor Code, Social Legislation)",
          "Intellectual Property Code (RA 8293)",
          "Consumer Act (RA 7394), Data Privacy (RA 10173)",
          "E-Commerce Law (RA 8792), Cybercrime (RA 10175)",
        ],
      },
    ],
  },
];

/** Fast lookup: course name → board exam */
export function getBoardExamForCourse(course: string): BoardExam | undefined {
  const trimmed = course.trim();
  return BOARD_EXAMS.find((exam) =>
    exam.courses.some((c) => c.trim().toLowerCase() === trimmed.toLowerCase())
  );
}

/** Fast lookup: board exam code → board exam */
export function getBoardExamByCode(code: string): BoardExam | undefined {
  return BOARD_EXAMS.find((exam) => exam.code === code);
}

/** Get all subjects for a course's board exam */
export function getBoardSubjectsForCourse(course: string): BoardSubject[] {
  const exam = getBoardExamForCourse(course);
  return exam?.subjects ?? [];
}

/** Check if a course has a board exam */
export function hasBoardExam(course: string): boolean {
  return getBoardExamForCourse(course) !== undefined;
}

/** Get board exam code for a course (for storing in user profile) */
export function getBoardExamCodeForCourse(course: string): string | null {
  const exam = getBoardExamForCourse(course);
  return exam?.code ?? null;
}

/** All unique board exam codes */
export const ALL_BOARD_EXAM_CODES = BOARD_EXAMS.map((e) => e.code) as BoardExam["code"][];

/** Type guard */
export function isBoardExamCode(code: string): code is BoardExam["code"] {
  return ALL_BOARD_EXAM_CODES.includes(code as BoardExam["code"]);
}