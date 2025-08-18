const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:4200', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Google Sheets Configuration - Updated with specific sheet tab
const SHEET_ID = '1yjOEf3aBN-MBKuUY1ypyrxRo5x2mqH3WAFZlz3aPbls';
const SHEET_GID = '1666091753'; // Specific sheet tab ID from your URL

// These will be populated from the first employee's answers
let CORRECT_ANSWERS = [];
let QUESTIONS = [];

// Helper function to fetch data using CSV export from specific sheet tab
async function fetchDataFromCSV() {
  const csvUrls = [
    // Primary URL with specific gid
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`,
    // Alternative URLs as fallback
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`,
    // Using sheet name if available
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`,
  ];

  console.log('📥 Fetching data from specific sheet tab...');
  console.log('📊 Sheet ID:', SHEET_ID);
  console.log('🏷️ Sheet GID:', SHEET_GID);
  
  // Import node-fetch dynamically
  const fetch = (await import('node-fetch')).default;
  
  // Try each URL method
  for (let i = 0; i < csvUrls.length; i++) {
    try {
      console.log(`🔗 Trying method ${i + 1}: ${csvUrls[i]}`);
      
      const response = await fetch(csvUrls[i], {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/csv,application/csv,text/plain,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        },
        timeout: 15000 // 15 second timeout
      });
      
      console.log(`📊 Response status: ${response.status} ${response.statusText}`);
      console.log(`📋 Content-Type: ${response.headers.get('content-type')}`);
      
      if (response.ok) {
        const csvData = await response.text();
        console.log('📄 CSV data length:', csvData.length);
        console.log('📝 First 200 characters:', csvData.substring(0, 200));
        
        if (csvData && csvData.length > 100 && !csvData.includes('<!DOCTYPE html')) {
          const rows = parseCSV(csvData);
          console.log('✅ Successfully parsed', rows.length, 'rows from method', i + 1);
          
          if (rows.length > 1) { // Must have header + at least 1 data row
            return rows;
          } else {
            console.log('⚠️ Insufficient data rows, trying next method');
          }
        } else {
          console.log('⚠️ Invalid CSV data or HTML response, trying next method');
        }
      } else {
        console.log(`❌ Method ${i + 1} failed: ${response.status} ${response.statusText}`);
        
        // Log response body for debugging
        const errorBody = await response.text();
        console.log('📄 Error response body (first 300 chars):', errorBody.substring(0, 300));
      }
    } catch (error) {
      console.log(`❌ Method ${i + 1} error:`, error.message);
    }
  }
  
  // If all methods fail, throw error
  throw new Error(`Failed to fetch data from all methods. Please check:
1. Sheet permissions (must be public - "Anyone with the link can view")
2. Sheet ID: ${SHEET_ID}
3. Sheet GID: ${SHEET_GID}
4. Internet connectivity`);
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
            current += '"'; // Escaped quote
            i++; // Skip next quote
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
      
      row.push(current.trim()); // Add the last field
      
      // Only add rows with sufficient data (at least 6 columns for basic info)
      if (row.length >= 6) {
        rows.push(row);
        if (lineIndex === 0) {
          console.log('📋 Header row parsed:', row.slice(0, 6)); // Show first 6 columns
        } else if (lineIndex === 1) {
          console.log('📝 First data row parsed:', row.slice(0, 6)); // Show first 6 columns
        }
      } else {
        console.log(`⚠️ Skipping row ${lineIndex + 1} - insufficient columns:`, row.length);
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
    console.log('⚠️ Insufficient data to initialize correct answers. Need at least header + 1 data row');
    console.log('📊 Available rows:', rows?.length || 0);
    return false;
  }
  
  const headerRow = rows[0];
  const firstEmployeeRow = rows[1]; // Second row is first employee (after header)
  
  console.log('📋 Header row length:', headerRow.length);
  console.log('👤 First employee row length:', firstEmployeeRow.length);
  console.log('📋 Header sample (columns 6-10):', headerRow.slice(6, 11));
  console.log('👤 First employee sample (columns 6-10):', firstEmployeeRow.slice(6, 11));
  
  // Extract questions from header (columns 6-15, or as many as available)
  const questionStartCol = 6;
  const maxQuestions = Math.min(10, headerRow.length - questionStartCol);
  
  QUESTIONS = headerRow.slice(questionStartCol, questionStartCol + maxQuestions).map(q => {
    // Remove question number prefix (e.g., "1. " from "1. Which law...")
    return q.replace(/^\d+\.\s*/, '').trim();
  });
  
  // Extract correct answers from first employee (same columns)
  CORRECT_ANSWERS = firstEmployeeRow.slice(questionStartCol, questionStartCol + maxQuestions).map(answer => answer?.trim() || '');
  
  console.log('✅ Initialization completed:');
  console.log('📝 Questions loaded:', QUESTIONS.length);
  console.log('✔️ Correct answers loaded:', CORRECT_ANSWERS.length);
  console.log('👨‍💼 Reference employee:', firstEmployeeRow[2] || 'Unknown');
  
  // Log the Q&A mapping for verification
  if (QUESTIONS.length > 0) {
    console.log('🔍 Question-Answer mapping:');
    QUESTIONS.forEach((question, index) => {
      const shortQuestion = question.length > 50 ? question.substring(0, 50) + '...' : question;
      console.log(`   Q${index + 1}: ${shortQuestion} → ${CORRECT_ANSWERS[index] || 'N/A'}`);
    });
  }
  
  return QUESTIONS.length > 0 && CORRECT_ANSWERS.length > 0;
}

// Helper function to check if answer is correct (comparing with first employee)
function isAnswerCorrect(userAnswer, questionIndex) {
  if (questionIndex >= CORRECT_ANSWERS.length || !userAnswer) return false;
  
  const normalizedUserAnswer = userAnswer.toLowerCase().trim();
  const normalizedCorrectAnswer = CORRECT_ANSWERS[questionIndex].toLowerCase().trim();
  
  return normalizedUserAnswer === normalizedCorrectAnswer;
}

// Helper function to map row data to test response
function mapRowToTestResponse(row, isFirstEmployee = false) {
  if (!row || row.length < 6) {
    console.log('⚠️ Invalid row - insufficient columns:', row?.length || 0);
    return null;
  }
  
  const timestamp = row[0] || '';
  const scoreFromSheet = row[1] || '';
  const fullName = row[2]?.trim() || '';
  const employeeId = row[3]?.trim() || '';
  const dateOfBirth = row[4]?.trim() || '';
  const department = row[5]?.trim() || '';
  
  if (!fullName) {
    console.log('⚠️ Skipping row - no name provided');
    return null;
  }
  
  // Extract answers from columns 6+ (Q1-Q10 or as many as available)
  const questionStartCol = 6;
  const userAnswers = row.slice(questionStartCol, questionStartCol + QUESTIONS.length);
  
  const answers = userAnswers.map((answer, index) => ({
    questionIndex: index,
    selectedAnswer: answer?.trim() || '',
    isCorrect: isFirstEmployee ? true : isAnswerCorrect(answer?.trim() || '', index) // First employee is always 100% correct
  }));
  
  // Calculate score
  const calculatedScore = answers.filter(a => a.isCorrect).length;
  
  // Parse submission date
  let submissionDate;
  try {
    submissionDate = new Date(timestamp);
    if (isNaN(submissionDate.getTime())) {
      submissionDate = new Date();
    }
  } catch (error) {
    submissionDate = new Date();
  }
  
  const testResponse = {
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
  
  if (isFirstEmployee) {
    console.log(`⭐ Reference Employee: ${fullName} - Score: ${calculatedScore}/${QUESTIONS.length} (100% by definition)`);
  } else {
    const percentage = QUESTIONS.length > 0 ? (calculatedScore / QUESTIONS.length * 100).toFixed(0) : 0;
    console.log(`👤 Employee: ${fullName} - Score: ${calculatedScore}/${QUESTIONS.length} (${percentage}%)`);
  }
  
  return testResponse;
}

// Helper function to process sheet data
function processSheetData(rows) {
  if (!rows || rows.length <= 1) {
    console.log('⚠️ No data rows to process. Available rows:', rows?.length || 0);
    return [];
  }
  
  console.log('🔄 Starting data processing...');
  console.log('📊 Total rows received:', rows.length);
  console.log('📋 Header row preview:', rows[0]?.slice(0, 6));
  
  // Initialize correct answers from first employee
  const initialized = initializeCorrectAnswers(rows);
  if (!initialized) {
    console.log('❌ Failed to initialize correct answers');
    return [];
  }
  
  const dataRows = rows.slice(1); // Skip header row
  console.log('📊 Processing', dataRows.length, 'employee rows');
  
  const testResponses = [];
  
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const isFirstEmployee = i === 0; // First data row is our reference
    
    console.log(`🔍 Processing row ${i + 1}/${dataRows.length}:`, row.slice(0, 3)); // Show name info
    
    const testResponse = mapRowToTestResponse(row, isFirstEmployee);
    
    if (testResponse) {
      testResponses.push(testResponse);
    }
  }
  
  console.log(`✅ Successfully processed ${testResponses.length} responses out of ${dataRows.length} rows`);
  if (testResponses.length > 0) {
    console.log(`⭐ Reference employee: ${testResponses[0]?.fullName} (100% correct by definition)`);
  }
  
  return testResponses;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Krishna Maruti Backend API is running (Specific Sheet Tab)',
    timestamp: new Date().toISOString(),
    config: {
      method: 'CSV Export from Specific Sheet Tab',
      sheetId: SHEET_ID,
      sheetGid: SHEET_GID,
      questionsLoaded: QUESTIONS.length,
      correctAnswersLoaded: CORRECT_ANSWERS.length,
      referenceEmployee: CORRECT_ANSWERS.length > 0 ? 'First employee in data' : 'Not loaded yet',
      sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`
    }
  });
});

// Test connection using CSV method with specific sheet tab
app.get('/api/test-connection', async (req, res) => {
  try {
    console.log('🧪 Testing CSV connection to specific sheet tab...');
    console.log('📊 Sheet ID:', SHEET_ID);
    console.log('🏷️ Sheet GID:', SHEET_GID);
    
    const rows = await fetchDataFromCSV();
    const initialized = initializeCorrectAnswers(rows);
    
    res.json({
      success: true,
      message: 'CSV connection successful with specific sheet tab',
      details: {
        method: 'CSV Export from Specific Sheet Tab',
        sheetId: SHEET_ID,
        sheetGid: SHEET_GID,
        totalRows: rows.length,
        headerRow: rows[0]?.slice(0, 6) || [], // Show first 6 columns
        firstEmployeeData: rows[1]?.slice(0, 6) || [], // Show first 6 columns
        questionsExtracted: QUESTIONS.length,
        correctAnswersExtracted: CORRECT_ANSWERS.length,
        referenceEmployee: rows[1]?.[2] || 'Unknown',
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
      instructions: [
        '1. Open your Google Sheet tab',
        `2. URL: https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`,
        '3. Click Share button',
        '4. Change access to "Anyone with the link can view"',
        '5. Ensure the specific sheet tab is publicly accessible',
        '6. Make sure first employee has the correct answers',
        `7. Test CSV URL: https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`
      ],
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
      metadata: {
        method: 'CSV Export from Specific Sheet Tab',
        sheetId: SHEET_ID,
        sheetGid: SHEET_GID,
        headerRow: rows[0] || [],
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
    console.log('📊 Sheet ID:', SHEET_ID);
    console.log('🏷️ Sheet GID:', SHEET_GID);
    
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
            message: 'No data available'
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
      referenceEmployee: testResponses[0], // First employee is reference
      metadata: {
        method: 'CSV Export from Specific Sheet Tab',
        sheetId: SHEET_ID,
        sheetGid: SHEET_GID,
        questions: QUESTIONS,
        correctAnswers: CORRECT_ANSWERS,
        referenceEmployeeName: testResponses[0]?.fullName || 'Unknown',
        sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`,
        totalQuestions: QUESTIONS.length
      }
    };

    console.log('📊 Statistics calculated from specific sheet tab:', {
      totalResponses: stats.totalResponses,
      passedCount: stats.passedCount,
      failedCount: stats.failedCount,
      averageScore: stats.averageScore,
      departments: stats.departments.length,
      referenceEmployee: stats.referenceEmployee?.fullName,
      questionsFound: QUESTIONS.length
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

// Get questions and correct answers (dynamically loaded from specific sheet tab)
app.get('/api/questions', (req, res) => {
  res.json({
    success: true,
    data: {
      questions: QUESTIONS,
      correctAnswers: CORRECT_ANSWERS,
      totalQuestions: QUESTIONS.length,
      source: 'Dynamically loaded from first employee in specific sheet tab',
      referenceNote: 'Questions from header row, correct answers from first employee',
      config: {
        sheetId: SHEET_ID,
        sheetGid: SHEET_GID,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`
      }
    }
  });
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

    const referenceEmployee = testResponses[0]; // First employee is reference

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
          sheetGid: SHEET_GID
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

// Get raw data for debugging from specific sheet tab
app.get('/api/debug/raw-data', async (req, res) => {
  try {
    console.log('🔍 Fetching raw data from specific sheet tab for debugging...');
    
    const rows = await fetchDataFromCSV();
    
    res.json({
      success: true,
      data: {
        method: 'CSV Export from Specific Sheet Tab',
        sheetId: SHEET_ID,
        sheetGid: SHEET_GID,
        totalRows: rows.length,
        headerRow: rows[0] || [],
        firstEmployeeRow: rows[1] || [],
        sampleDataRows: rows.slice(1, 6),
        extractedQuestions: QUESTIONS,
        extractedCorrectAnswers: CORRECT_ANSWERS,
        allRows: rows,
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

// Install node-fetch if not present
async function ensureNodeFetch() {
  try {
    await import('node-fetch');
    console.log('✅ node-fetch is available');
  } catch (error) {
    console.log('❌ node-fetch not found. Installing...');
    console.log('Please run: npm install node-fetch');
    process.exit(1);
  }
}

// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, async () => {
  await ensureNodeFetch();
  
  console.log(`🚀 Krishna Maruti Backend Server running on port ${PORT}`);
  console.log(`🌐 Using Specific Sheet Tab CSV Export method`);
  console.log(`📊 Sheet ID: ${SHEET_ID}`);
  console.log(`🏷️ Sheet GID: ${SHEET_GID}`);
  console.log(`🔗 Sheet URL: https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`);
  console.log(`📄 CSV URL: https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`);
  console.log('\n🎯 Dynamic Processing from Specific Sheet Tab:');
  console.log('   • Questions extracted from header row (columns 6+)');
  console.log('   • Correct answers taken from first employee (row 2)');
  console.log('   • First employee automatically scores 100%');
  console.log('   • Other employees compared against first employee');
  console.log('\n📋 Available endpoints:');
  console.log(`  - GET http://localhost:${PORT}/api/health`);
  console.log(`  - GET http://localhost:${PORT}/api/test-connection`);
  console.log(`  - GET http://localhost:${PORT}/api/dashboard-stats`);
  console.log(`  - GET http://localhost:${PORT}/api/test-responses`);
  console.log(`  - GET http://localhost:${PORT}/api/questions`);
  console.log(`  - GET http://localhost:${PORT}/api/response/:employeeId`);
  console.log(`  - GET http://localhost:${PORT}/api/debug/raw-data`);
  console.log('\n🧪 Test endpoints:');
  console.log(`  curl http://localhost:${PORT}/api/test-connection`);
  console.log(`  curl http://localhost:${PORT}/api/dashboard-stats`);
  console.log('\n⚠️ Important: Make sure the specific sheet tab is publicly accessible!');
});

module.exports = app;
