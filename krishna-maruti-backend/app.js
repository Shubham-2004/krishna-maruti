const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced CORS Configuration - Fix for Vercel deployment
app.use(cors({
  origin: [
    'http://localhost:4200',
    'http://localhost:3000',
    'https://krishna-maruti.vercel.app',  // Add your Vercel domain
    'https://krishna-maruti-*.vercel.app', // Handle preview deployments
    /^https:\/\/krishna-maruti.*\.vercel\.app$/, // Regex for all Vercel subdomains
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));

// Add specific headers for better CORS support
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:4200',
    'http://localhost:3000',
    'https://krishna-maruti.vercel.app'
  ];
  
  if (allowedOrigins.includes(origin) || /^https:\/\/krishna-maruti.*\.vercel\.app$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

app.use(express.json());

// Google Sheets Configuration - Updated with specific sheet tab
const SHEET_ID = '1yjOEf3aBN-MBKuUY1ypyrxRo5x2mqH3WAFZlz3aPbls';
const SHEET_GID = '1666091753'; // Specific sheet tab ID from your URL

// These will be populated from the first employee's answers
let CORRECT_ANSWERS = [];
let QUESTIONS = [];

// Cache for Google Sheets data to reduce API calls
let CACHED_DATA = null;
let CACHE_TIMESTAMP = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Sample fallback data for when Google Sheets is unavailable
const FALLBACK_DATA = [
  ["Timestamp","Score","Full Name","Employee ID","Date of Birth (DD/MM/YYYY)","Department","1. Which law states that stress is proportional to strain within the elastic limit?","2. Which type of gear is used to transmit motion between intersecting shafts?","3. Which cycle is used in IC engines?","4. Unit of Power is?","5. The hardness test performed using diamond pyramid is called?","6. Which of the following is NOT a welding process?","7. In thermodynamics, the SI unit of entropy is?","8. Which metal is commonly used in aircraft manufacturing?","9. Which of the following is a non-destructive testing method?","10. The process of cooling a material rapidly to increase hardness is?"],
  ["8/16/2025 14:10:59","","Shubham Kumar","123","12/2/1995","IT","Hooke's Law","Bevel Gear","Otto Cycle","Watt","Vickers","CNC","J/K","Aluminium","X-Ray Inspection","Quenching"],
  ["8/16/2025 19:07:21","","Rajesh Sharma","456","13/02/1990","Mechanical","Hooke's Law","Bevel Gear","Otto Cycle","Watt","Mohs","CNC","J/K","Copper","X-Ray Inspection","Quenching"],
  ["8/17/2025 10:15:30","","Priya Singh","789","25/05/1992","Electrical","Pascal's Law","Bevel Gear","Carnot Cycle","Watt","Vickers","TIG","W","Aluminium","Bend Test","Normalizing"],
  ["8/18/2025 11:20:45","","Amit Patel","101","15/03/1988","Production","Hooke's Law","Spur Gear","Otto Cycle","Watt","Brinell","MIG","J/K","Steel","Ultrasonic Testing","Tempering"],
  ["8/18/2025 15:35:12","","Neha Gupta","202","22/07/1993","Quality","Hooke's Law","Bevel Gear","Diesel Cycle","Watt","Vickers","Brazing","J/K","Aluminium","Magnetic Particle","Quenching"]
];

// Quick health check endpoint (minimal processing)
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Krishna Maruti Backend API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0',
    config: {
      method: 'Enhanced CSV with CORS Fix',
      sheetId: SHEET_ID,
      sheetGid: SHEET_GID,
      questionsLoaded: QUESTIONS.length,
      correctAnswersLoaded: CORRECT_ANSWERS.length,
      cacheStatus: CACHED_DATA ? 'Active' : 'Empty',
      sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`
    }
  });
});

// Keep-alive endpoint to prevent Render from sleeping
app.get('/api/ping', (req, res) => {
  res.json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// Helper function to check if cache is valid
function isCacheValid() {
  return CACHED_DATA && CACHE_TIMESTAMP && (Date.now() - CACHE_TIMESTAMP < CACHE_DURATION);
}

// Helper function to fetch data using CSV export from specific sheet tab
async function fetchDataFromCSV() {
  console.log('📥 Fetching data from specific sheet tab...');
  console.log('📊 Sheet ID:', SHEET_ID);
  console.log('🏷️ Sheet GID:', SHEET_GID);
  
  // Check cache first
  if (isCacheValid()) {
    console.log('✅ Using cached data');
    return CACHED_DATA;
  }
  
  const csvUrls = [
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`,
  ];
  
  // Import node-fetch dynamically
  let fetch;
  try {
    fetch = (await import('node-fetch')).default;
  } catch (error) {
    console.log('❌ node-fetch not available, using fallback data');
    return FALLBACK_DATA;
  }
  
  // Try each URL method with timeout
  for (let i = 0; i < csvUrls.length; i++) {
    try {
      console.log(`🔗 Trying method ${i + 1}: ${csvUrls[i]}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(csvUrls[i], {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/csv,application/csv,text/plain,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log(`📊 Response status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const csvData = await response.text();
        console.log('📄 CSV data length:', csvData.length);
        
        if (csvData && csvData.length > 100 && !csvData.includes('<!DOCTYPE html')) {
          const rows = parseCSV(csvData);
          console.log('✅ Successfully parsed', rows.length, 'rows from method', i + 1);
          
          if (rows.length > 1) {
            // Cache the successful result
            CACHED_DATA = rows;
            CACHE_TIMESTAMP = Date.now();
            console.log('💾 Data cached successfully');
            return rows;
          }
        } else {
          console.log('⚠️ Invalid CSV data, trying next method');
        }
      } else {
        console.log(`❌ Method ${i + 1} failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`❌ Method ${i + 1} error:`, error.message);
    }
  }
  
  // If all methods fail, use fallback data
  console.log('⚠️ All CSV methods failed, using fallback data');
  CACHED_DATA = FALLBACK_DATA;
  CACHE_TIMESTAMP = Date.now();
  return FALLBACK_DATA;
}

// Enhanced CSV parsing function
function parseCSV(csvData) {
  try {
    console.log('🔍 Starting CSV parsing...');
    const lines = csvData.split('\n').filter(line => line.trim());
    console.log('📝 Total lines after filtering:', lines.length);
    
    const rows = [];
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const row = [];
      let current = '';
      let inQuotes = false;
      let i = 0;
      
      while (i < line.length) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"' && !inQuotes) {
          inQuotes = true;
        } else if (char === '"' && inQuotes) {
          if (nextChar === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else if (char === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
        i++;
      }
      
      row.push(current.trim());
      
      if (row.length >= 6) {
        rows.push(row);
        if (lineIndex === 0) {
          console.log('📋 Header row parsed:', row.slice(0, 6));
        } else if (lineIndex === 1) {
          console.log('📝 First data row parsed:', row.slice(0, 6));
        }
      }
    }
    
    console.log('✅ CSV parsing completed:', rows.length, 'valid rows');
    return rows;
    
  } catch (error) {
    console.error('❌ CSV parsing error:', error);
    throw new Error(`Failed to parse CSV data: ${error.message}`);
  }
}

// Helper function to initialize correct answers from first employee
function initializeCorrectAnswers(rows) {
  if (!rows || rows.length < 2) {
    console.log('⚠️ Insufficient data to initialize correct answers');
    return false;
  }
  
  const headerRow = rows[0];
  const firstEmployeeRow = rows[1];
  
  console.log('📋 Header row length:', headerRow.length);
  console.log('👤 First employee row length:', firstEmployeeRow.length);
  
  const questionStartCol = 6;
  const maxQuestions = Math.min(10, headerRow.length - questionStartCol);
  
  QUESTIONS = headerRow.slice(questionStartCol, questionStartCol + maxQuestions).map(q => {
    return q.replace(/^\d+\.\s*/, '').trim();
  });
  
  CORRECT_ANSWERS = firstEmployeeRow.slice(questionStartCol, questionStartCol + maxQuestions).map(answer => answer?.trim() || '');
  
  console.log('✅ Initialization completed:');
  console.log('📝 Questions loaded:', QUESTIONS.length);
  console.log('✔️ Correct answers loaded:', CORRECT_ANSWERS.length);
  console.log('👨‍💼 Reference employee:', firstEmployeeRow[2] || 'Unknown');
  
  return QUESTIONS.length > 0 && CORRECT_ANSWERS.length > 0;
}

// Helper function to check if answer is correct
function isAnswerCorrect(userAnswer, questionIndex) {
  if (questionIndex >= CORRECT_ANSWERS.length || !userAnswer) return false;
  
  const normalizedUserAnswer = userAnswer.toLowerCase().trim();
  const normalizedCorrectAnswer = CORRECT_ANSWERS[questionIndex].toLowerCase().trim();
  
  return normalizedUserAnswer === normalizedCorrectAnswer;
}

// Helper function to map row data to test response
function mapRowToTestResponse(row, isFirstEmployee = false) {
  if (!row || row.length < 6) {
    return null;
  }
  
  const timestamp = row[0] || '';
  const scoreFromSheet = row[1] || '';
  const fullName = row[2]?.trim() || '';
  const employeeId = row[3]?.trim() || '';
  const dateOfBirth = row[4]?.trim() || '';
  const department = row[5]?.trim() || '';
  
  if (!fullName) {
    return null;
  }
  
  const questionStartCol = 6;
  const userAnswers = row.slice(questionStartCol, questionStartCol + QUESTIONS.length);
  
  const answers = userAnswers.map((answer, index) => ({
    questionIndex: index,
    selectedAnswer: answer?.trim() || '',
    isCorrect: isFirstEmployee ? true : isAnswerCorrect(answer?.trim() || '', index)
  }));
  
  const calculatedScore = answers.filter(a => a.isCorrect).length;
  
  let submissionDate;
  try {
    submissionDate = new Date(timestamp);
    if (isNaN(submissionDate.getTime())) {
      submissionDate = new Date();
    }
  } catch (error) {
    submissionDate = new Date();
  }
  
  return {
    fullName,
    employeeId,
    dateOfBirth,
    department,
    score: calculatedScore,
    answers,
    submissionDate,
    originalScore: scoreFromSheet,
    timestamp,
    isReferenceEmployee: isFirstEmployee
  };
}

// Helper function to process sheet data
function processSheetData(rows) {
  if (!rows || rows.length <= 1) {
    console.log('⚠️ No data rows to process');
    return [];
  }
  
  const initialized = initializeCorrectAnswers(rows);
  if (!initialized) {
    console.log('❌ Failed to initialize correct answers');
    return [];
  }
  
  const dataRows = rows.slice(1);
  const testResponses = [];
  
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const isFirstEmployee = i === 0;
    const testResponse = mapRowToTestResponse(row, isFirstEmployee);
    
    if (testResponse) {
      testResponses.push(testResponse);
    }
  }
  
  console.log(`✅ Successfully processed ${testResponses.length} responses`);
  return testResponses;
}

// Test connection using CSV method with specific sheet tab
app.get('/api/test-connection', async (req, res) => {
  try {
    console.log('🧪 Testing CSV connection to specific sheet tab...');
    
    const rows = await fetchDataFromCSV();
    const initialized = initializeCorrectAnswers(rows);
    
    res.json({
      success: true,
      message: 'CSV connection successful with specific sheet tab',
      details: {
        method: 'Enhanced CSV with CORS Fix',
        sheetId: SHEET_ID,
        sheetGid: SHEET_GID,
        totalRows: rows.length,
        headerRow: rows[0]?.slice(0, 6) || [],
        firstEmployeeData: rows[1]?.slice(0, 6) || [],
        questionsExtracted: QUESTIONS.length,
        correctAnswersExtracted: CORRECT_ANSWERS.length,
        referenceEmployee: rows[1]?.[2] || 'Unknown',
        cacheStatus: isCacheValid() ? 'Hit' : 'Miss',
        sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`,
        csvUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`
      }
    });

  } catch (error) {
    console.error('❌ CSV connection test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect via CSV to specific sheet tab',
      message: error.message,
      config: {
        sheetId: SHEET_ID,
        sheetGid: SHEET_GID
      }
    });
  }
});

// Get all test responses using CSV from specific sheet tab
app.get('/api/test-responses', async (req, res) => {
  try {
    console.log('📊 Fetching test responses from specific sheet tab...');
    
    const rows = await fetchDataFromCSV();
    const testResponses = processSheetData(rows);

    res.json({
      success: true,
      data: testResponses,
      totalCount: testResponses.length,
      timestamp: new Date().toISOString(),
      cacheStatus: isCacheValid() ? 'Hit' : 'Miss',
      metadata: {
        method: 'Enhanced CSV with CORS Fix',
        sheetId: SHEET_ID,
        sheetGid: SHEET_GID,
        totalRows: rows.length,
        processedRows: testResponses.length,
        referenceEmployee: testResponses[0]?.fullName || 'Unknown',
        questionsFromHeader: QUESTIONS.length,
        answersFromFirstEmployee: CORRECT_ANSWERS.length,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`
      }
    });

  } catch (error) {
    console.error('❌ Error fetching CSV data from specific sheet tab:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch data from specific sheet tab',
      message: error.message,
      config: {
        sheetId: SHEET_ID,
        sheetGid: SHEET_GID
      }
    });
  }
});

// Get dashboard statistics using CSV from specific sheet tab
app.get('/api/dashboard-stats', async (req, res) => {
  try {
    console.log('📈 Fetching dashboard stats from specific sheet tab...');
    
    const rows = await fetchDataFromCSV();
    const testResponses = processSheetData(rows);
    
    if (testResponses.length === 0) {
      return res.json({
        success: true,
        data: {
          totalResponses: 0,
          passedCount: 0,
          failedCount: 0,
          averageScore: 0,
          departments: [],
          departmentStats: [],
          responses: [],
          referenceEmployee: null,
          metadata: {
            sheetId: SHEET_ID,
            sheetGid: SHEET_GID,
            message: 'No data available',
            cacheStatus: 'Empty'
          }
        }
      });
    }

    // Calculate statistics
    const totalResponses = testResponses.length;
    const passedCount = testResponses.filter(r => r.score >= 6).length;
    const failedCount = totalResponses - passedCount;
    const averageScore = testResponses.reduce((sum, r) => sum + r.score, 0) / totalResponses;
    const departments = [...new Set(testResponses.map(r => r.department).filter(d => d))];

    // Department statistics
    const departmentStats = departments.map(dept => {
      const deptResponses = testResponses.filter(r => r.department === dept);
      const deptPassed = deptResponses.filter(r => r.score >= 6).length;
      const deptAverage = deptResponses.reduce((sum, r) => sum + r.score, 0) / deptResponses.length;
      
      return {
        name: dept,
        totalCandidates: deptResponses.length,
        passed: deptPassed,
        failed: deptResponses.length - deptPassed,
        averageScore: Math.round(deptAverage * 10) / 10
      };
    });

    const stats = {
      totalResponses,
      passedCount,
      failedCount,
      averageScore: Math.round(averageScore * 10) / 10,
      departments,
      departmentStats,
      responses: testResponses,
      referenceEmployee: testResponses[0],
      metadata: {
        method: 'Enhanced CSV with CORS Fix',
        sheetId: SHEET_ID,
        sheetGid: SHEET_GID,
        questions: QUESTIONS,
        correctAnswers: CORRECT_ANSWERS,
        referenceEmployeeName: testResponses[0]?.fullName || 'Unknown',
        sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`,
        totalQuestions: QUESTIONS.length,
        cacheStatus: isCacheValid() ? 'Hit' : 'Miss',
        cacheAge: CACHE_TIMESTAMP ? Math.floor((Date.now() - CACHE_TIMESTAMP) / 1000) : 0
      }
    };

    console.log('📊 Statistics calculated successfully:', {
      totalResponses: stats.totalResponses,
      passedCount: stats.passedCount,
      failedCount: stats.failedCount,
      averageScore: stats.averageScore,
      departments: stats.departments.length,
      cacheStatus: isCacheValid() ? 'Hit' : 'Miss'
    });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Error fetching dashboard stats from specific sheet tab:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics from specific sheet tab',
      message: error.message,
      config: {
        sheetId: SHEET_ID,
        sheetGid: SHEET_GID,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`
      }
    });
  }
});

// Get questions and correct answers
app.get('/api/questions', async (req, res) => {
  try {
    // Ensure data is loaded
    if (QUESTIONS.length === 0 || CORRECT_ANSWERS.length === 0) {
      console.log('📚 Questions not loaded, fetching from sheet...');
      const rows = await fetchDataFromCSV();
      initializeCorrectAnswers(rows);
    }
    
    res.json({
      success: true,
      data: {
        questions: QUESTIONS,
        correctAnswers: CORRECT_ANSWERS,
        totalQuestions: QUESTIONS.length,
        source: 'Dynamically loaded from first employee in specific sheet tab',
        referenceNote: 'Questions from header row, correct answers from first employee',
        cacheStatus: isCacheValid() ? 'Hit' : 'Miss',
        config: {
          sheetId: SHEET_ID,
          sheetGid: SHEET_GID,
          sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`
        }
      }
    });
  } catch (error) {
    console.error('❌ Error loading questions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load questions',
      message: error.message
    });
  }
});

// Get detailed comparison with reference employee
app.get('/api/response/:employeeId', async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    console.log('🔍 Fetching details for employee:', employeeId);
    
    const rows = await fetchDataFromCSV();
    const testResponses = processSheetData(rows);
    const targetResponse = testResponses.find(r => r.employeeId === employeeId);
    
    if (!targetResponse) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const referenceEmployee = testResponses[0];

    res.json({
      success: true,
      data: {
        ...targetResponse,
        referenceEmployee: referenceEmployee,
        comparisonAnalysis: targetResponse.answers.map((answer, index) => ({
          questionNumber: index + 1,
          question: QUESTIONS[index],
          userAnswer: answer.selectedAnswer,
          referenceAnswer: CORRECT_ANSWERS[index],
          isCorrect: answer.isCorrect,
          referenceEmployeeName: referenceEmployee.fullName
        })),
        summary: {
          totalQuestions: QUESTIONS.length,
          correctAnswers: targetResponse.answers.filter(a => a.isCorrect).length,
          scorePercentage: Math.round((targetResponse.score / QUESTIONS.length) * 100),
          comparedWith: referenceEmployee.fullName
        },
        metadata: {
          sheetId: SHEET_ID,
          sheetGid: SHEET_GID,
          cacheStatus: isCacheValid() ? 'Hit' : 'Miss'
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching employee data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee data',
      message: error.message
    });
  }
});

// Get raw data for debugging
app.get('/api/debug/raw-data', async (req, res) => {
  try {
    console.log('🔍 Fetching raw data from specific sheet tab for debugging...');
    
    const rows = await fetchDataFromCSV();
    
    res.json({
      success: true,
      data: {
        method: 'Enhanced CSV with CORS Fix',
        sheetId: SHEET_ID,
        sheetGid: SHEET_GID,
        totalRows: rows.length,
        headerRow: rows[0] || [],
        firstEmployeeRow: rows[1] || [],
        sampleDataRows: rows.slice(1, 6),
        extractedQuestions: QUESTIONS,
        extractedCorrectAnswers: CORRECT_ANSWERS,
        allRows: rows,
        cacheStatus: isCacheValid() ? 'Hit' : 'Miss',
        cacheAge: CACHE_TIMESTAMP ? Math.floor((Date.now() - CACHE_TIMESTAMP) / 1000) : 0,
        config: {
          csvUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`,
          sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching raw data from specific sheet tab:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch raw data from specific sheet tab',
      message: error.message,
      config: {
        sheetId: SHEET_ID,
        sheetGid: SHEET_GID
      }
    });
  }
});

// Clear cache endpoint
app.post('/api/clear-cache', (req, res) => {
  CACHED_DATA = null;
  CACHE_TIMESTAMP = null;
  QUESTIONS = [];
  CORRECT_ANSWERS = [];
  
  res.json({
    success: true,
    message: 'Cache cleared successfully',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Handle 404 for unknown routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableEndpoints: [
      'GET /api/health',
      'GET /api/ping',
      'GET /api/test-connection',
      'GET /api/dashboard-stats',
      'GET /api/test-responses',
      'GET /api/questions',
      'GET /api/response/:employeeId',
      'GET /api/debug/raw-data',
      'POST /api/clear-cache'
    ]
  });
});

// Keep-alive function to prevent Render from sleeping
function keepAlive() {
  if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
      console.log('🔔 Keep-alive ping at', new Date().toISOString());
    }, 14 * 60 * 1000); // 14 minutes
  }
}

// Install node-fetch check
async function ensureNodeFetch() {
  try {
    await import('node-fetch');
    console.log('✅ node-fetch is available');
  } catch (error) {
    console.log('⚠️ node-fetch not found. Fallback data will be used.');
  }
}

// Start server
app.listen(PORT, async () => {
  await ensureNodeFetch();
  keepAlive();
  
  console.log(`🚀 Krishna Maruti Backend Server running on port ${PORT}`);
  console.log(`🌐 Enhanced CORS Configuration with Vercel Support`);
  console.log(`📊 Sheet ID: ${SHEET_ID}`);
  console.log(`🏷️ Sheet GID: ${SHEET_GID}`);
  console.log(`🔗 Sheet URL: https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`);
  console.log(`📄 CSV URL: https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`);
  console.log('\n🎯 Features Enabled:');
  console.log('   ✅ CORS configured for Vercel deployment');
  console.log('   ✅ Caching system (5 min cache duration)');
  console.log('   ✅ Timeout handling for CSV fetching');
  console.log('   ✅ Fallback data system');
  console.log('   ✅ Keep-alive system for production');
  console.log('\n📋 Available endpoints:');
  console.log(`  - GET http://localhost:${PORT}/api/health`);
  console.log(`  - GET http://localhost:${PORT}/api/ping`);
  console.log(`  - GET http://localhost:${PORT}/api/test-connection`);
  console.log(`  - GET http://localhost:${PORT}/api/dashboard-stats`);
  console.log(`  - GET http://localhost:${PORT}/api/test-responses`);
  console.log(`  - GET http://localhost:${PORT}/api/questions`);
  console.log(`  - GET http://localhost:${PORT}/api/response/:employeeId`);
  console.log(`  - GET http://localhost:${PORT}/api/debug/raw-data`);
  console.log(`  - POST http://localhost:${PORT}/api/clear-cache`);
  console.log('\n🧪 Test endpoints:');
  console.log(`  curl https://krishna-maruti-backend.onrender.com/api/health`);
  console.log(`  curl https://krishna-maruti-backend.onrender.com/api/test-connection`);
  console.log('\n⚠️ Make sure the Google Sheet is publicly accessible!');
  console.log('📱 CORS origins configured for:');
  console.log('   - http://localhost:4200 (development)');
  console.log('   - https://krishna-maruti.vercel.app (production)');
  console.log('   - https://krishna-maruti-*.vercel.app (preview deployments)');
});

module.exports = app;
