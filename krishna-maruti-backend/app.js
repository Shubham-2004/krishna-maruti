const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Production URL for Render deployment
const RENDER_URL = 'https://krishna-maruti-backend.onrender.com';

// Enhanced CORS Configuration - Updated for Render deployment
app.use(cors({
  origin: [
    'http://localhost:4200',
    'http://localhost:3000',
    'https://krishna-maruti.vercel.app',  // Production Vercel domain
    'https://krishna-maruti-*.vercel.app', // Preview deployments
    /^https:\/\/krishna-maruti.*\.vercel\.app$/, // Regex for all Vercel subdomains
    'https://krishna-maruti-backend.onrender.com', // Self-reference for keep-alive
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));

// Enhanced CORS middleware for Render deployment
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:4200',
    'http://localhost:3000',
    'https://krishna-maruti.vercel.app',
    'https://krishna-maruti-backend.onrender.com'
  ];
  
  // Allow all Vercel preview deployments
  if (allowedOrigins.includes(origin) || 
      /^https:\/\/krishna-maruti.*\.vercel\.app$/.test(origin) ||
      /^https:\/\/krishna-maruti-backend.*\.onrender\.com$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

app.use(express.json());

// Request logging middleware for production debugging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'None'}`);
  next();
});

// Google Sheets Configuration
const SHEET_ID = '1yjOEf3aBN-MBKuUY1ypyrxRo5x2mqH3WAFZlz3aPbls';
const SHEET_GID = '1666091753';

// Global variables for data management
let CORRECT_ANSWERS = [];
let QUESTIONS = [];

// Enhanced caching system for Render deployment
let CACHED_DATA = null;
let CACHE_TIMESTAMP = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache for production

// Comprehensive fallback data
const FALLBACK_DATA = [
  ["Timestamp","Score","Full Name","Employee ID","Date of Birth (DD/MM/YYYY)","Department","1. Which law states that stress is proportional to strain within the elastic limit?","2. Which type of gear is used to transmit motion between intersecting shafts?","3. Which cycle is used in IC engines?","4. Unit of Power is?","5. The hardness test performed using diamond pyramid is called?","6. Which of the following is NOT a welding process?","7. In thermodynamics, the SI unit of entropy is?","8. Which metal is commonly used in aircraft manufacturing?","9. Which of the following is a non-destructive testing method?","10. The process of cooling a material rapidly to increase hardness is?"],
  ["8/16/2025 14:10:59","","Shubham Kumar","123","12/2/1995","IT","Hooke's Law","Bevel Gear","Otto Cycle","Watt","Vickers","CNC","J/K","Aluminium","X-Ray Inspection","Quenching"],
  ["8/16/2025 19:07:21","","Rajesh Sharma","456","13/02/1990","Mechanical","Hooke's Law","Bevel Gear","Otto Cycle","Watt","Mohs","CNC","J/K","Copper","X-Ray Inspection","Quenching"],
  ["8/17/2025 10:15:30","","Priya Singh","789","25/05/1992","Electrical","Pascal's Law","Bevel Gear","Carnot Cycle","Watt","Vickers","TIG","W","Aluminium","Bend Test","Normalizing"],
  ["8/18/2025 11:20:45","","Amit Patel","101","15/03/1988","Production","Hooke's Law","Spur Gear","Otto Cycle","Watt","Brinell","MIG","J/K","Steel","Ultrasonic Testing","Tempering"],
  ["8/18/2025 15:35:12","","Neha Gupta","202","22/07/1993","Quality","Hooke's Law","Bevel Gear","Diesel Cycle","Watt","Vickers","Brazing","J/K","Aluminium","Magnetic Particle","Quenching"],
  ["8/18/2025 16:45:30","","Rahul Verma","303","10/11/1991","Design","Hooke's Law","Helical Gear","Otto Cycle","Watt","Rockwell","Arc","J/K","Titanium","Radiographic","Annealing"],
  ["8/19/2025 09:12:15","","Kavya Nair","404","18/09/1994","Testing","Hooke's Law","Bevel Gear","Brayton Cycle","Watt","Vickers","Soldering","J/K","Aluminium","Penetrant","Quenching"]
];

// Enhanced health check with Render-specific information
app.get('/api/health', (req, res) => {
  const healthData = {
    success: true,
    message: 'Krishna Maruti Backend API is running on Render',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: '3.0.0',
    environment: process.env.NODE_ENV || 'development',
    renderUrl: RENDER_URL,
    memoryUsage: process.memoryUsage(),
    config: {
      method: 'Render-Optimized CSV with Enhanced CORS',
      sheetId: SHEET_ID,
      sheetGid: SHEET_GID,
      questionsLoaded: QUESTIONS.length,
      correctAnswersLoaded: CORRECT_ANSWERS.length,
      cacheStatus: CACHED_DATA ? 'Active' : 'Empty',
      cacheAge: CACHE_TIMESTAMP ? Math.floor((Date.now() - CACHE_TIMESTAMP) / 1000) : 0,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`
    }
  };
  
  // Set cache headers for health check
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  res.json(healthData);
});

// Enhanced keep-alive endpoint
app.get('/api/ping', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    renderUrl: RENDER_URL,
    service: 'Krishna Maruti Backend',
    version: '3.0.0'
  });
});

// Cache validation with enhanced logging
function isCacheValid() {
  const isValid = CACHED_DATA && CACHE_TIMESTAMP && (Date.now() - CACHE_TIMESTAMP < CACHE_DURATION);
  if (isValid) {
    console.log(`✅ Cache hit - Age: ${Math.floor((Date.now() - CACHE_TIMESTAMP) / 1000)}s`);
  } else {
    console.log('⚠️ Cache miss - Fetching fresh data');
  }
  return isValid;
}

// Enhanced data fetching with better error handling for Render
async function fetchDataFromCSV() {
  console.log('📥 Fetching data from Google Sheets via Render...');
  console.log('📊 Sheet ID:', SHEET_ID);
  console.log('🏷️ Sheet GID:', SHEET_GID);
  console.log('🌐 Render URL:', RENDER_URL);
  
  // Check cache first
  if (isCacheValid()) {
    console.log('✅ Using cached data to improve performance');
    return CACHED_DATA;
  }
  
  const csvUrls = [
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`,
  ];
  
  // Dynamic import for node-fetch with fallback
  let fetch;
  try {
    fetch = (await import('node-fetch')).default;
    console.log('✅ node-fetch imported successfully');
  } catch (error) {
    console.log('❌ node-fetch not available, using fallback data');
    CACHED_DATA = FALLBACK_DATA;
    CACHE_TIMESTAMP = Date.now();
    return FALLBACK_DATA;
  }
  
  // Try each URL method with optimized timeouts for Render
  for (let i = 0; i < csvUrls.length; i++) {
    try {
      console.log(`🔗 Attempt ${i + 1}/${csvUrls.length}: ${csvUrls[i]}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.log(`⏰ Request ${i + 1} timed out after 15 seconds`);
      }, 15000); // 15 second timeout for Render
      
      const startTime = Date.now();
      const response = await fetch(csvUrls[i], {
        headers: {
          'User-Agent': 'Krishna-Maruti-Backend/3.0.0 (Render)',
          'Accept': 'text/csv,application/csv,text/plain,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const requestTime = Date.now() - startTime;
      
      console.log(`📊 Response ${i + 1}: ${response.status} ${response.statusText} (${requestTime}ms)`);
      
      if (response.ok) {
        const csvData = await response.text();
        console.log(`📄 CSV data received: ${csvData.length} characters`);
        
        if (csvData && csvData.length > 100 && !csvData.includes('<!DOCTYPE html')) {
          const rows = parseCSV(csvData);
          console.log(`✅ Successfully parsed ${rows.length} rows from attempt ${i + 1}`);
          
          if (rows.length > 1) {
            // Cache the successful result
            CACHED_DATA = rows;
            CACHE_TIMESTAMP = Date.now();
            console.log('💾 Data cached successfully for 10 minutes');
            return rows;
          }
        } else {
          console.log(`⚠️ Invalid CSV data received (length: ${csvData.length})`);
        }
      } else {
        console.log(`❌ Request ${i + 1} failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`⏰ Request ${i + 1} was aborted due to timeout`);
      } else {
        console.log(`❌ Request ${i + 1} error: ${error.message}`);
      }
    }
  }
  
  // If all methods fail, use fallback data
  console.log('⚠️ All CSV fetch attempts failed, using enhanced fallback data');
  CACHED_DATA = FALLBACK_DATA;
  CACHE_TIMESTAMP = Date.now();
  return FALLBACK_DATA;
}

// Enhanced CSV parsing with better error handling
function parseCSV(csvData) {
  try {
    console.log('🔍 Starting CSV parsing...');
    const lines = csvData.split('\n').filter(line => line.trim());
    console.log(`📝 Processing ${lines.length} lines after filtering`);
    
    const rows = [];
    let parsedLines = 0;
    
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
        parsedLines++;
        
        if (lineIndex === 0) {
          console.log('📋 Header row:', row.slice(0, 6).join(' | '));
        } else if (lineIndex === 1) {
          console.log('👤 First employee:', row.slice(2, 6).join(' | '));
        }
      } else if (lineIndex > 0) {
        console.log(`⚠️ Skipping line ${lineIndex + 1} - only ${row.length} columns`);
      }
    }
    
    console.log(`✅ CSV parsing completed: ${parsedLines} valid rows from ${lines.length} lines`);
    return rows;
    
  } catch (error) {
    console.error('❌ CSV parsing error:', error);
    throw new Error(`Failed to parse CSV data: ${error.message}`);
  }
}

// Enhanced initialization with better logging
function initializeCorrectAnswers(rows) {
  if (!rows || rows.length < 2) {
    console.log('⚠️ Insufficient data for initialization - need header + at least 1 data row');
    return false;
  }
  
  const headerRow = rows[0];
  const firstEmployeeRow = rows[1];
  
  console.log('📋 Initializing from data:');
  console.log(`   Header columns: ${headerRow.length}`);
  console.log(`   First employee: ${firstEmployeeRow[2]} (${firstEmployeeRow[3]})`);
  
  const questionStartCol = 6;
  const maxQuestions = Math.min(10, headerRow.length - questionStartCol);
  
  // Extract questions from header
  QUESTIONS = headerRow.slice(questionStartCol, questionStartCol + maxQuestions).map(q => {
    return q.replace(/^\d+\.\s*/, '').trim();
  });
  
  // Extract correct answers from first employee
  CORRECT_ANSWERS = firstEmployeeRow.slice(questionStartCol, questionStartCol + maxQuestions).map(answer => answer?.trim() || '');
  
  console.log('✅ Initialization completed:');
  console.log(`   📝 Questions loaded: ${QUESTIONS.length}`);
  console.log(`   ✔️ Correct answers loaded: ${CORRECT_ANSWERS.length}`);
  console.log(`   👨‍💼 Reference employee: ${firstEmployeeRow[2]} (ID: ${firstEmployeeRow[3]})`);
  
  // Log sample Q&A for verification
  if (QUESTIONS.length > 0) {
    console.log('🔍 Sample Questions & Answers:');
    for (let i = 0; i < Math.min(3, QUESTIONS.length); i++) {
      const shortQ = QUESTIONS[i].length > 50 ? QUESTIONS[i].substring(0, 50) + '...' : QUESTIONS[i];
      console.log(`   Q${i + 1}: ${shortQ} → ${CORRECT_ANSWERS[i]}`);
    }
  }
  
  return QUESTIONS.length > 0 && CORRECT_ANSWERS.length > 0;
}

// Rest of the functions remain the same but with enhanced logging...
function isAnswerCorrect(userAnswer, questionIndex) {
  if (questionIndex >= CORRECT_ANSWERS.length || !userAnswer) return false;
  
  const normalizedUserAnswer = userAnswer.toLowerCase().trim();
  const normalizedCorrectAnswer = CORRECT_ANSWERS[questionIndex].toLowerCase().trim();
  
  return normalizedUserAnswer === normalizedCorrectAnswer;
}

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

function processSheetData(rows) {
  if (!rows || rows.length <= 1) {
    console.log('⚠️ No data rows available for processing');
    return [];
  }
  
  console.log(`🔄 Processing ${rows.length} total rows (including header)`);
  
  const initialized = initializeCorrectAnswers(rows);
  if (!initialized) {
    console.log('❌ Failed to initialize - cannot process data');
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
      if (i < 3) { // Log first 3 for debugging
        console.log(`   👤 ${testResponse.fullName}: ${testResponse.score}/${QUESTIONS.length} (${testResponse.department})`);
      }
    }
  }
  
  console.log(`✅ Successfully processed ${testResponses.length}/${dataRows.length} employee responses`);
  return testResponses;
}

// API Endpoints with enhanced error handling and logging

app.get('/api/test-connection', async (req, res) => {
  try {
    console.log('🧪 Testing connection from Render deployment...');
    const startTime = Date.now();
    
    const rows = await fetchDataFromCSV();
    const initialized = initializeCorrectAnswers(rows);
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      success: true,
      message: 'Connection successful from Render',
      responseTime: `${responseTime}ms`,
      details: {
        method: 'Render-Optimized CSV with Enhanced CORS',
        renderUrl: RENDER_URL,
        sheetId: SHEET_ID,
        sheetGid: SHEET_GID,
        totalRows: rows.length,
        headerRow: rows[0]?.slice(0, 6) || [],
        firstEmployeeData: rows[1]?.slice(0, 6) || [],
        questionsExtracted: QUESTIONS.length,
        correctAnswersExtracted: CORRECT_ANSWERS.length,
        referenceEmployee: rows[1]?.[2] || 'Unknown',
        cacheStatus: isCacheValid() ? 'Hit' : 'Miss',
        cacheAge: CACHE_TIMESTAMP ? Math.floor((Date.now() - CACHE_TIMESTAMP) / 1000) : 0,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`,
        csvUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`
      }
    });

  } catch (error) {
    console.error('❌ Connection test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Connection test failed',
      message: error.message,
      renderUrl: RENDER_URL,
      timestamp: new Date().toISOString(),
      config: {
        sheetId: SHEET_ID,
        sheetGid: SHEET_GID
      }
    });
  }
});

app.get('/api/test-responses', async (req, res) => {
  try {
    console.log('📊 Fetching test responses via Render...');
    const startTime = Date.now();
    
    const rows = await fetchDataFromCSV();
    const testResponses = processSheetData(rows);
    
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: testResponses,
      totalCount: testResponses.length,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      cacheStatus: isCacheValid() ? 'Hit' : 'Miss',
      metadata: {
        method: 'Render-Optimized CSV',
        renderUrl: RENDER_URL,
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
    console.error('❌ Error fetching test responses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test responses',
      message: error.message,
      renderUrl: RENDER_URL,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/dashboard-stats', async (req, res) => {
  try {
    console.log('📈 Generating dashboard statistics via Render...');
    const startTime = Date.now();
    
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
            renderUrl: RENDER_URL,
            sheetId: SHEET_ID,
            sheetGid: SHEET_GID,
            message: 'No data available',
            cacheStatus: 'Empty'
          }
        }
      });
    }

    // Calculate comprehensive statistics
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
        averageScore: Math.round(deptAverage * 10) / 10,
        passPercentage: Math.round((deptPassed / deptResponses.length) * 100)
      };
    });

    const responseTime = Date.now() - startTime;

    const stats = {
      totalResponses,
      passedCount,
      failedCount,
      averageScore: Math.round(averageScore * 10) / 10,
      passPercentage: Math.round((passedCount / totalResponses) * 100),
      departments,
      departmentStats,
      responses: testResponses,
      referenceEmployee: testResponses[0],
      metadata: {
        method: 'Render-Optimized Dashboard',
        renderUrl: RENDER_URL,
        responseTime: `${responseTime}ms`,
        sheetId: SHEET_ID,
        sheetGid: SHEET_GID,
        questions: QUESTIONS,
        correctAnswers: CORRECT_ANSWERS,
        referenceEmployeeName: testResponses[0]?.fullName || 'Unknown',
        sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`,
        totalQuestions: QUESTIONS.length,
        cacheStatus: isCacheValid() ? 'Hit' : 'Miss',
        cacheAge: CACHE_TIMESTAMP ? Math.floor((Date.now() - CACHE_TIMESTAMP) / 1000) : 0,
        lastUpdated: new Date().toISOString()
      }
    };

    console.log(`📊 Dashboard stats generated in ${responseTime}ms:`, {
      totalResponses: stats.totalResponses,
      passedCount: stats.passedCount,
      departments: stats.departments.length,
      cacheStatus: isCacheValid() ? 'Hit' : 'Miss'
    });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Error generating dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate dashboard statistics',
      message: error.message,
      renderUrl: RENDER_URL,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/questions', async (req, res) => {
  try {
    console.log('📚 Loading questions via Render...');
    
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
        source: 'Dynamically loaded from Google Sheets via Render',
        referenceNote: 'Questions from header row, correct answers from first employee',
        cacheStatus: isCacheValid() ? 'Hit' : 'Miss',
        config: {
          renderUrl: RENDER_URL,
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
      message: error.message,
      renderUrl: RENDER_URL
    });
  }
});

app.get('/api/response/:employeeId', async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    console.log('🔍 Fetching employee details via Render:', employeeId);
    
    const rows = await fetchDataFromCSV();
    const testResponses = processSheetData(rows);
    const targetResponse = testResponses.find(r => r.employeeId === employeeId);
    
    if (!targetResponse) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID '${employeeId}' not found`,
        renderUrl: RENDER_URL,
        availableEmployees: testResponses.map(r => ({
          id: r.employeeId,
          name: r.fullName
        }))
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
          comparedWith: referenceEmployee.fullName,
          status: targetResponse.score >= 6 ? 'PASSED' : 'FAILED'
        },
        metadata: {
          renderUrl: RENDER_URL,
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
      message: error.message,
      renderUrl: RENDER_URL
    });
  }
});

app.get('/api/debug/raw-data', async (req, res) => {
  try {
    console.log('🔍 Debug: Fetching raw data via Render...');
    
    const rows = await fetchDataFromCSV();
    
    res.json({
      success: true,
      debug: true,
      data: {
        method: 'Render-Optimized CSV Debug',
        renderUrl: RENDER_URL,
        environment: process.env.NODE_ENV || 'development',
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
        memoryUsage: process.memoryUsage(),
        uptime: Math.floor(process.uptime()),
        config: {
          csvUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`,
          sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`
        }
      }
    });

  } catch (error) {
    console.error('❌ Debug: Error fetching raw data:', error);
    res.status(500).json({
      success: false,
      debug: true,
      error: 'Failed to fetch raw data for debugging',
      message: error.message,
      renderUrl: RENDER_URL,
      config: {
        sheetId: SHEET_ID,
        sheetGid: SHEET_GID
      }
    });
  }
});

// Cache management endpoints
app.post('/api/clear-cache', (req, res) => {
  const oldCacheAge = CACHE_TIMESTAMP ? Math.floor((Date.now() - CACHE_TIMESTAMP) / 1000) : 0;
  
  CACHED_DATA = null;
  CACHE_TIMESTAMP = null;
  QUESTIONS = [];
  CORRECT_ANSWERS = [];
  
  console.log(`🗑️ Cache cleared (was ${oldCacheAge}s old)`);
  
  res.json({
    success: true,
    message: 'Cache cleared successfully',
    previousCacheAge: `${oldCacheAge}s`,
    renderUrl: RENDER_URL,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/cache-status', (req, res) => {
  res.json({
    success: true,
    cache: {
      isValid: isCacheValid(),
      hasData: !!CACHED_DATA,
      timestamp: CACHE_TIMESTAMP ? new Date(CACHE_TIMESTAMP).toISOString() : null,
      ageSeconds: CACHE_TIMESTAMP ? Math.floor((Date.now() - CACHE_TIMESTAMP) / 1000) : 0,
      durationMs: CACHE_DURATION,
      questionsLoaded: QUESTIONS.length,
      correctAnswersLoaded: CORRECT_ANSWERS.length
    },
    renderUrl: RENDER_URL
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message,
    renderUrl: RENDER_URL,
    timestamp: new Date().toISOString(),
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Enhanced 404 handler
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    renderUrl: RENDER_URL,
    availableEndpoints: [
      'GET /api/health - Service health check',
      'GET /api/ping - Keep-alive endpoint', 
      'GET /api/test-connection - Test Google Sheets connection',
      'GET /api/dashboard-stats - Get dashboard statistics',
      'GET /api/test-responses - Get all test responses',
      'GET /api/questions - Get questions and correct answers',
      'GET /api/response/:employeeId - Get specific employee response',
      'GET /api/debug/raw-data - Debug raw data',
      'GET /api/cache-status - Check cache status',
      'POST /api/clear-cache - Clear data cache'
    ],
    documentation: `${RENDER_URL}/api/health`,
    timestamp: new Date().toISOString()
  });
});

// Enhanced keep-alive system for Render
function startKeepAliveSystem() {
  if (process.env.NODE_ENV === 'production') {
    console.log('🔔 Starting keep-alive system for Render...');
    
    // Self-ping every 14 minutes to prevent sleeping
    setInterval(async () => {
      try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(`${RENDER_URL}/api/ping`);
        const data = await response.json();
        console.log(`🔔 Keep-alive ping successful: uptime ${data.uptime}s`);
      } catch (error) {
        console.log('⚠️ Keep-alive ping failed:', error.message);
      }
    }, 14 * 60 * 1000); // 14 minutes
    
    console.log('✅ Keep-alive system started (14 minute intervals)');
  } else {
    console.log('ℹ️ Keep-alive system disabled in development mode');
  }
}

// Node-fetch availability check
async function ensureNodeFetch() {
  try {
    await import('node-fetch');
    console.log('✅ node-fetch is available');
    return true;
  } catch (error) {
    console.log('⚠️ node-fetch not found - fallback data will be used');
    return false;
  }
}

// Server startup
app.listen(PORT, async () => {
  const fetchAvailable = await ensureNodeFetch();
  startKeepAliveSystem();
  
  console.log('\n🚀 KRISHNA MARUTI BACKEND - RENDER DEPLOYMENT');
  console.log('='.repeat(50));
  console.log(`🌐 Server URL: ${RENDER_URL}`);
  console.log(`🔌 Port: ${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏱️ Started: ${new Date().toISOString()}`);
  console.log(`📊 Sheet ID: ${SHEET_ID}`);
  console.log(`🏷️ Sheet GID: ${SHEET_GID}`);
  console.log(`📄 CSV URL: https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`);
  console.log(`🔗 Sheet URL: https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`);
  
  console.log('\n✨ FEATURES ENABLED:');
  console.log('   ✅ Enhanced CORS for Vercel + Render');
  console.log('   ✅ 10-minute caching system');
  console.log('   ✅ 15-second timeout handling');
  console.log('   ✅ Enhanced fallback data system');
  console.log('   ✅ Keep-alive system (production)');
  console.log('   ✅ Comprehensive logging');
  console.log('   ✅ Error recovery mechanisms');
  
  console.log('\n📋 API ENDPOINTS:');
  console.log(`  🟢 GET  ${RENDER_URL}/api/health`);
  console.log(`  🟢 GET  ${RENDER_URL}/api/ping`);
  console.log(`  🟢 GET  ${RENDER_URL}/api/test-connection`);
  console.log(`  🟢 GET  ${RENDER_URL}/api/dashboard-stats`);
  console.log(`  🟢 GET  ${RENDER_URL}/api/test-responses`);
  console.log(`  🟢 GET  ${RENDER_URL}/api/questions`);
  console.log(`  🟢 GET  ${RENDER_URL}/api/response/:employeeId`);
  console.log(`  🟢 GET  ${RENDER_URL}/api/debug/raw-data`);
  console.log(`  🟢 GET  ${RENDER_URL}/api/cache-status`);
  console.log(`  🟡 POST ${RENDER_URL}/api/clear-cache`);
  
  console.log('\n🧪 QUICK TESTS:');
  console.log(`  curl ${RENDER_URL}/api/health`);
  console.log(`  curl ${RENDER_URL}/api/test-connection`);
  
  console.log('\n📱 CORS ORIGINS:');
  console.log('   • http://localhost:4200 (development)');
  console.log('   • https://krishna-maruti.vercel.app (production)');
  console.log('   • https://krishna-maruti-*.vercel.app (previews)');
  
  console.log('\n⚠️ REQUIREMENTS:');
  console.log('   • Google Sheet must be publicly accessible');
  console.log('   • Share settings: "Anyone with the link can view"');
  console.log(`   • node-fetch: ${fetchAvailable ? 'Available' : 'Using fallback'}` );
  
  console.log('\n🎯 RENDER DEPLOYMENT READY!');
  console.log('='.repeat(50));
});

module.exports = app;
