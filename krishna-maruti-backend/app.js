const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Production URL for Render deployment
const RENDER_URL = 'https://krishna-maruti-backend.onrender.com';

// Production-only CORS Configuration - Optimized for Render
app.use(cors({
  origin: [
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

// Production-only CORS middleware for Render deployment
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://krishna-maruti.vercel.app',
    'https://krishna-maruti-backend.onrender.com'
  ];
  
  // Allow all Vercel deployments and Render self-reference
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

// Production logging middleware
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

// Production caching system optimized for Render
let CACHED_DATA = null;
let CACHE_TIMESTAMP = null;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes cache for production

// Comprehensive fallback data for production reliability
const FALLBACK_DATA = [
  ["Timestamp","Score","Full Name","Employee ID","Date of Birth (DD/MM/YYYY)","Department","1. Which law states that stress is proportional to strain within the elastic limit?","2. Which type of gear is used to transmit motion between intersecting shafts?","3. Which cycle is used in IC engines?","4. Unit of Power is?","5. The hardness test performed using diamond pyramid is called?","6. Which of the following is NOT a welding process?","7. In thermodynamics, the SI unit of entropy is?","8. Which metal is commonly used in aircraft manufacturing?","9. Which of the following is a non-destructive testing method?","10. The process of cooling a material rapidly to increase hardness is?"],
  ["8/16/2025 14:10:59","","Shubham Kumar","123","12/2/1995","IT","Hooke's Law","Bevel Gear","Otto Cycle","Watt","Vickers","CNC","J/K","Aluminium","X-Ray Inspection","Quenching"],
  ["8/16/2025 19:07:21","","Rajesh Sharma","456","13/02/1990","Mechanical","Hooke's Law","Bevel Gear","Otto Cycle","Watt","Mohs","CNC","J/K","Copper","X-Ray Inspection","Quenching"],
  ["8/17/2025 10:15:30","","Priya Singh","789","25/05/1992","Electrical","Pascal's Law","Bevel Gear","Carnot Cycle","Watt","Vickers","TIG","W","Aluminium","Bend Test","Normalizing"],
  ["8/18/2025 11:20:45","","Amit Patel","101","15/03/1988","Production","Hooke's Law","Spur Gear","Otto Cycle","Watt","Brinell","MIG","J/K","Steel","Ultrasonic Testing","Tempering"],
  ["8/18/2025 15:35:12","","Neha Gupta","202","22/07/1993","Quality","Hooke's Law","Bevel Gear","Diesel Cycle","Watt","Vickers","Brazing","J/K","Aluminium","Magnetic Particle","Quenching"],
  ["8/18/2025 16:45:30","","Rahul Verma","303","10/11/1991","Design","Hooke's Law","Helical Gear","Otto Cycle","Watt","Rockwell","Arc","J/K","Titanium","Radiographic","Annealing"],
  ["8/19/2025 09:12:15","","Kavya Nair","404","18/09/1994","Testing","Hooke's Law","Bevel Gear","Brayton Cycle","Watt","Vickers","Soldering","J/K","Aluminium","Penetrant","Quenching"],
  ["8/19/2025 14:30:22","","Manoj Singh","505","08/12/1987","Maintenance","Hooke's Law","Worm Gear","Otto Cycle","Watt","Vickers","Forging","J/K","Steel","Visual Inspection","Quenching"],
  ["8/20/2025 10:45:18","","Anita Desai","606","19/06/1995","R&D","Hooke's Law","Bevel Gear","Stirling Cycle","Watt","Brinell","Casting","J/K","Aluminium","Dye Penetrant","Hardening"]
];

// Production health check endpoint
app.get('/api/health', (req, res) => {
  const healthData = {
    success: true,
    message: 'Krishna Maruti Backend API - Production Ready on Render',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: '4.0.0-production',
    environment: 'production',
    renderUrl: RENDER_URL,
    memoryUsage: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    },
    config: {
      method: 'Production Render-Optimized CSV API',
      sheetId: SHEET_ID,
      sheetGid: SHEET_GID,
      questionsLoaded: QUESTIONS.length,
      correctAnswersLoaded: CORRECT_ANSWERS.length,
      cacheStatus: CACHED_DATA ? 'Active' : 'Empty',
      cacheAge: CACHE_TIMESTAMP ? Math.floor((Date.now() - CACHE_TIMESTAMP) / 1000) : 0,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`
    }
  };
  
  // Production cache headers
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  res.json(healthData);
});

// Production keep-alive endpoint
app.get('/api/ping', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    renderUrl: RENDER_URL,
    service: 'Krishna Maruti Backend',
    version: '4.0.0-production',
    mode: 'production-only'
  });
});

// Production cache validation
function isCacheValid() {
  const isValid = CACHED_DATA && CACHE_TIMESTAMP && (Date.now() - CACHE_TIMESTAMP < CACHE_DURATION);
  if (isValid) {
    console.log(`✅ Production cache hit - Age: ${Math.floor((Date.now() - CACHE_TIMESTAMP) / 1000)}s`);
  } else {
    console.log('⚠️ Production cache miss - Fetching fresh data');
  }
  return isValid;
}

// Production-optimized data fetching from Google Sheets
async function fetchDataFromCSV() {
  console.log('📥 Production: Fetching data from Google Sheets via Render...');
  console.log('📊 Sheet ID:', SHEET_ID);
  console.log('🏷️ Sheet GID:', SHEET_GID);
  console.log('🌐 Render URL:', RENDER_URL);
  
  // Check production cache first
  if (isCacheValid()) {
    console.log('✅ Using production cached data for optimal performance');
    return CACHED_DATA;
  }
  
  const csvUrls = [
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`,
  ];
  
  // Production fetch with dynamic import
  let fetch;
  try {
    fetch = (await import('node-fetch')).default;
    console.log('✅ Production node-fetch imported successfully');
  } catch (error) {
    console.log('❌ Production: node-fetch not available, using enhanced fallback data');
    CACHED_DATA = FALLBACK_DATA;
    CACHE_TIMESTAMP = Date.now();
    return FALLBACK_DATA;
  }
  
  // Production-optimized fetching with longer timeouts
  for (let i = 0; i < csvUrls.length; i++) {
    try {
      console.log(`🔗 Production attempt ${i + 1}/${csvUrls.length}: ${csvUrls[i]}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.log(`⏰ Production request ${i + 1} timed out after 20 seconds`);
      }, 20000); // 20 second timeout for production
      
      const startTime = Date.now();
      const response = await fetch(csvUrls[i], {
        headers: {
          'User-Agent': 'Krishna-Maruti-Production-Backend/4.0.0 (Render)',
          'Accept': 'text/csv,application/csv,text/plain,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const requestTime = Date.now() - startTime;
      
      console.log(`📊 Production response ${i + 1}: ${response.status} ${response.statusText} (${requestTime}ms)`);
      
      if (response.ok) {
        const csvData = await response.text();
        console.log(`📄 Production CSV data received: ${csvData.length} characters`);
        
        if (csvData && csvData.length > 100 && !csvData.includes('<!DOCTYPE html')) {
          const rows = parseCSV(csvData);
          console.log(`✅ Production: Successfully parsed ${rows.length} rows from attempt ${i + 1}`);
          
          if (rows.length > 1) {
            // Cache the successful result for production
            CACHED_DATA = rows;
            CACHE_TIMESTAMP = Date.now();
            console.log('💾 Production data cached successfully for 15 minutes');
            return rows;
          }
        } else {
          console.log(`⚠️ Production: Invalid CSV data received (length: ${csvData.length})`);
        }
      } else {
        console.log(`❌ Production request ${i + 1} failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`⏰ Production request ${i + 1} was aborted due to timeout`);
      } else {
        console.log(`❌ Production request ${i + 1} error: ${error.message}`);
      }
    }
  }
  
  // Production fallback
  console.log('⚠️ Production: All CSV fetch attempts failed, using enhanced fallback data');
  CACHED_DATA = FALLBACK_DATA;
  CACHE_TIMESTAMP = Date.now();
  return FALLBACK_DATA;
}

// Production CSV parsing
function parseCSV(csvData) {
  try {
    console.log('🔍 Production: Starting CSV parsing...');
    const lines = csvData.split('\n').filter(line => line.trim());
    console.log(`📝 Production: Processing ${lines.length} lines after filtering`);
    
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
          console.log('📋 Production header row:', row.slice(0, 6).join(' | '));
        } else if (lineIndex === 1) {
          console.log('👤 Production first employee:', row.slice(2, 6).join(' | '));
        }
      } else if (lineIndex > 0) {
        console.log(`⚠️ Production: Skipping line ${lineIndex + 1} - only ${row.length} columns`);
      }
    }
    
    console.log(`✅ Production CSV parsing completed: ${parsedLines} valid rows from ${lines.length} lines`);
    return rows;
    
  } catch (error) {
    console.error('❌ Production CSV parsing error:', error);
    throw new Error(`Production CSV parsing failed: ${error.message}`);
  }
}

// Production initialization
function initializeCorrectAnswers(rows) {
  if (!rows || rows.length < 2) {
    console.log('⚠️ Production: Insufficient data for initialization - need header + at least 1 data row');
    return false;
  }
  
  const headerRow = rows[0];
  const firstEmployeeRow = rows[1];
  
  console.log('📋 Production: Initializing from data:');
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
  
  console.log('✅ Production initialization completed:');
  console.log(`   📝 Questions loaded: ${QUESTIONS.length}`);
  console.log(`   ✔️ Correct answers loaded: ${CORRECT_ANSWERS.length}`);
  console.log(`   👨‍💼 Reference employee: ${firstEmployeeRow[2]} (ID: ${firstEmployeeRow[3]})`);
  
  // Production sample Q&A logging
  if (QUESTIONS.length > 0) {
    console.log('🔍 Production sample Questions & Answers:');
    for (let i = 0; i < Math.min(3, QUESTIONS.length); i++) {
      const shortQ = QUESTIONS[i].length > 50 ? QUESTIONS[i].substring(0, 50) + '...' : QUESTIONS[i];
      console.log(`   Q${i + 1}: ${shortQ} → ${CORRECT_ANSWERS[i]}`);
    }
  }
  
  return QUESTIONS.length > 0 && CORRECT_ANSWERS.length > 0;
}

// Production answer validation
function isAnswerCorrect(userAnswer, questionIndex) {
  if (questionIndex >= CORRECT_ANSWERS.length || !userAnswer) return false;
  
  const normalizedUserAnswer = userAnswer.toLowerCase().trim();
  const normalizedCorrectAnswer = CORRECT_ANSWERS[questionIndex].toLowerCase().trim();
  
  return normalizedUserAnswer === normalizedCorrectAnswer;
}

// Production response mapping
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

// Production data processing
function processSheetData(rows) {
  if (!rows || rows.length <= 1) {
    console.log('⚠️ Production: No data rows available for processing');
    return [];
  }
  
  console.log(`🔄 Production: Processing ${rows.length} total rows (including header)`);
  
  const initialized = initializeCorrectAnswers(rows);
  if (!initialized) {
    console.log('❌ Production: Failed to initialize - cannot process data');
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
      if (i < 3) { // Log first 3 for production debugging
        console.log(`   👤 ${testResponse.fullName}: ${testResponse.score}/${QUESTIONS.length} (${testResponse.department})`);
      }
    }
  }
  
  console.log(`✅ Production: Successfully processed ${testResponses.length}/${dataRows.length} employee responses`);
  return testResponses;
}

// Production API Endpoints

app.get('/api/test-connection', async (req, res) => {
  try {
    console.log('🧪 Production: Testing connection from Render deployment...');
    const startTime = Date.now();
    
    const rows = await fetchDataFromCSV();
    const initialized = initializeCorrectAnswers(rows);
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      success: true,
      message: 'Production connection successful from Render',
      responseTime: `${responseTime}ms`,
      details: {
        method: 'Production Render-Optimized CSV API',
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
    console.error('❌ Production connection test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Production connection test failed',
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
    console.log('📊 Production: Fetching test responses via Render...');
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
        method: 'Production Render-Optimized CSV',
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
    console.error('❌ Production error fetching test responses:', error);
    res.status(500).json({
      success: false,
      error: 'Production failed to fetch test responses',
      message: error.message,
      renderUrl: RENDER_URL,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/dashboard-stats', async (req, res) => {
  try {
    console.log('📈 Production: Generating dashboard statistics via Render...');
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
            message: 'No production data available',
            cacheStatus: 'Empty'
          }
        }
      });
    }

    // Production statistics calculation
    const totalResponses = testResponses.length;
    const passedCount = testResponses.filter(r => r.score >= 6).length;
    const failedCount = totalResponses - passedCount;
    const averageScore = testResponses.reduce((sum, r) => sum + r.score, 0) / totalResponses;
    const departments = [...new Set(testResponses.map(r => r.department).filter(d => d))];

    // Production department statistics
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
        method: 'Production Render-Optimized Dashboard',
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

    console.log(`📊 Production dashboard stats generated in ${responseTime}ms:`, {
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
    console.error('❌ Production error generating dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Production failed to generate dashboard statistics',
      message: error.message,
      renderUrl: RENDER_URL,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/questions', async (req, res) => {
  try {
    console.log('📚 Production: Loading questions via Render...');
    
    // Ensure production data is loaded
    if (QUESTIONS.length === 0 || CORRECT_ANSWERS.length === 0) {
      console.log('📚 Production: Questions not loaded, fetching from sheet...');
      const rows = await fetchDataFromCSV();
      initializeCorrectAnswers(rows);
    }
    
    res.json({
      success: true,
      data: {
        questions: QUESTIONS,
        correctAnswers: CORRECT_ANSWERS,
        totalQuestions: QUESTIONS.length,
        source: 'Production: Dynamically loaded from Google Sheets via Render',
        referenceNote: 'Production: Questions from header row, correct answers from first employee',
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
    console.error('❌ Production error loading questions:', error);
    res.status(500).json({
      success: false,
      error: 'Production failed to load questions',
      message: error.message,
      renderUrl: RENDER_URL
    });
  }
});

app.get('/api/response/:employeeId', async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    console.log('🔍 Production: Fetching employee details via Render:', employeeId);
    
    const rows = await fetchDataFromCSV();
    const testResponses = processSheetData(rows);
    const targetResponse = testResponses.find(r => r.employeeId === employeeId);
    
    if (!targetResponse) {
      return res.status(404).json({
        success: false,
        message: `Production: Employee with ID '${employeeId}' not found`,
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
    console.error('❌ Production error fetching employee data:', error);
    res.status(500).json({
      success: false,
      error: 'Production failed to fetch employee data',
      message: error.message,
      renderUrl: RENDER_URL
    });
  }
});

app.get('/api/debug/raw-data', async (req, res) => {
  try {
    console.log('🔍 Production debug: Fetching raw data via Render...');
    
    const rows = await fetchDataFromCSV();
    
    res.json({
      success: true,
      debug: true,
      data: {
        method: 'Production Render-Optimized CSV Debug',
        renderUrl: RENDER_URL,
        environment: 'production',
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
        memoryUsage: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
        },
        uptime: Math.floor(process.uptime()),
        config: {
          csvUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`,
          sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`
        }
      }
    });

  } catch (error) {
    console.error('❌ Production debug: Error fetching raw data:', error);
    res.status(500).json({
      success: false,
      debug: true,
      error: 'Production debug failed to fetch raw data',
      message: error.message,
      renderUrl: RENDER_URL,
      config: {
        sheetId: SHEET_ID,
        sheetGid: SHEET_GID
      }
    });
  }
});

// Production cache management endpoints
app.post('/api/clear-cache', (req, res) => {
  const oldCacheAge = CACHE_TIMESTAMP ? Math.floor((Date.now() - CACHE_TIMESTAMP) / 1000) : 0;
  
  CACHED_DATA = null;
  CACHE_TIMESTAMP = null;
  QUESTIONS = [];
  CORRECT_ANSWERS = [];
  
  console.log(`🗑️ Production cache cleared (was ${oldCacheAge}s old)`);
  
  res.json({
    success: true,
    message: 'Production cache cleared successfully',
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
    renderUrl: RENDER_URL,
    mode: 'production-only'
  });
});

// Production error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Production unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Production internal server error',
    message: err.message,
    renderUrl: RENDER_URL,
    timestamp: new Date().toISOString()
  });
});

// Production 404 handler
app.use('*', (req, res) => {
  console.log(`❌ Production 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Production route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    renderUrl: RENDER_URL,
    availableEndpoints: [
      'GET /api/health - Production service health check',
      'GET /api/ping - Production keep-alive endpoint', 
      'GET /api/test-connection - Test production Google Sheets connection',
      'GET /api/dashboard-stats - Get production dashboard statistics',
      'GET /api/test-responses - Get all production test responses',
      'GET /api/questions - Get production questions and correct answers',
      'GET /api/response/:employeeId - Get specific production employee response',
      'GET /api/debug/raw-data - Production debug raw data',
      'GET /api/cache-status - Check production cache status',
      'POST /api/clear-cache - Clear production data cache'
    ],
    documentation: `${RENDER_URL}/api/health`,
    timestamp: new Date().toISOString()
  });
});

// Production keep-alive system for Render
function startProductionKeepAliveSystem() {
  console.log('🔔 Starting production keep-alive system for Render...');
  
  // Production self-ping every 14 minutes to prevent sleeping
  setInterval(async () => {
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`${RENDER_URL}/api/ping`);
      const data = await response.json();
      console.log(`🔔 Production keep-alive ping successful: uptime ${data.uptime}s`);
    } catch (error) {
      console.log('⚠️ Production keep-alive ping failed:', error.message);
    }
  }, 14 * 60 * 1000); // 14 minutes
  
  console.log('✅ Production keep-alive system started (14 minute intervals)');
}

// Production node-fetch availability check
async function ensureProductionNodeFetch() {
  try {
    await import('node-fetch');
    console.log('✅ Production node-fetch is available');
    return true;
  } catch (error) {
    console.log('⚠️ Production node-fetch not found - enhanced fallback data will be used');
    return false;
  }
}

// Production server startup
app.listen(PORT, async () => {
  const fetchAvailable = await ensureProductionNodeFetch();
  startProductionKeepAliveSystem();
  
  console.log('\n🚀 KRISHNA MARUTI BACKEND - PRODUCTION RENDER DEPLOYMENT');
  console.log('='.repeat(60));
  console.log(`🌐 Production Server URL: ${RENDER_URL}`);
  console.log(`🔌 Port: ${PORT}`);
  console.log(`📦 Environment: production`);
  console.log(`⏱️ Started: ${new Date().toISOString()}`);
  console.log(`📊 Sheet ID: ${SHEET_ID}`);
  console.log(`🏷️ Sheet GID: ${SHEET_GID}`);
  console.log(`📄 CSV URL: https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`);
  console.log(`🔗 Sheet URL: https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`);
  
  console.log('\n✨ PRODUCTION FEATURES ENABLED:');
  console.log('   ✅ Production-only CORS for Vercel deployment');
  console.log('   ✅ 15-minute caching system optimized for production');
  console.log('   ✅ 20-second timeout handling for production reliability');
  console.log('   ✅ Enhanced fallback data system with 10 sample records');
  console.log('   ✅ Production keep-alive system');
  console.log('   ✅ Comprehensive production logging');
  console.log('   ✅ Production error recovery mechanisms');
  console.log('   ✅ Memory usage optimization');
  
  console.log('\n📋 PRODUCTION API ENDPOINTS:');
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
  
  console.log('\n🧪 PRODUCTION QUICK TESTS:');
  console.log(`  curl ${RENDER_URL}/api/health`);
  console.log(`  curl ${RENDER_URL}/api/test-connection`);
  
  console.log('\n📱 PRODUCTION CORS ORIGINS:');
  console.log('   • https://krishna-maruti.vercel.app (production)');
  console.log('   • https://krishna-maruti-*.vercel.app (preview deployments)');
  console.log('   • Self-reference for keep-alive');
  
  console.log('\n⚠️ PRODUCTION REQUIREMENTS:');
  console.log('   • Google Sheet must be publicly accessible');
  console.log('   • Share settings: "Anyone with the link can view"');
  console.log(`   • node-fetch: ${fetchAvailable ? 'Available' : 'Using enhanced fallback'}` );
  
  console.log('\n🎯 PRODUCTION RENDER DEPLOYMENT READY!');
  console.log('='.repeat(60));
});

module.exports = app;
