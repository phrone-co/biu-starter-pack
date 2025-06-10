const redis = require("redis");
const { DateTime } = require("luxon");
const readline = require("readline"); // For terminal input
require("dotenv").config();

const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || "";

let redisClient; // Declare redisClient globally to be accessible

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function connectRedis() {
  if (!redisClient) {
    redisClient = redis.createClient({
      socket: {
        host: REDIS_HOST,
        port: REDIS_PORT,
      },
      password: REDIS_PASSWORD,
    });

    redisClient.on("error", (err) => console.error("Redis Error:", err));
  }

  if (!redisClient.isOpen) {
    try {
      await redisClient.connect();
      console.log("✅ Connected to Redis");
    } catch (error) {
      console.error("❌ Redis connection failed:", error);
      throw error; // Re-throw to propagate the error
    }
  }
}

async function disconnectRedis() {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    console.log("Disconnected from Redis");
  }
}

async function fetchStudentLogin(matricNumber) {
  try {
    const studentData = await redisClient.hGet(
      `student-login-new`,
      matricNumber
    );
    return studentData ? JSON.parse(studentData) : null;
  } catch (error) {
    console.error(`Error fetching student ${matricNumber}:`, error);
    return null;
  }
}

async function fetchStudentExams(studentId) {
  try {
    const studentData = await redisClient.hGet(`studentsss-new`, studentId);
    return studentData ? JSON.parse(studentData) : null;
  } catch (error) {
    console.error(`Error fetching student ${studentId}:`, error);
    return null;
  }
}

async function fetchStudentExamAttempt(studentId, examId) {
  try {
    const examAttemptData = await redisClient.hGet(
      `student-exams-new`,
      `${studentId}-${examId}`
    );
    return examAttemptData ? JSON.parse(examAttemptData) : null;
  } catch (error) {
    console.error(
      `Error fetching student exam attempt ${studentId}-${examId}:`,
      error
    );
    return null;
  }
}

async function addStudentExamAttempt(studentId, examId, examQuestions) {
  try {
    await redisClient.hSet(
      `student-exams-new`,
      `${studentId}-${examId}`,
      JSON.stringify(examQuestions)
    );
    console.log(`Added/Updated student exam ${studentId}-${examId}`);
  } catch (error) {
    console.error(
      `Error adding/updating student exam ${studentId}-${examId}:`,
      error
    );
  }
}

async function increaseStudentExamTime(
  examId,
  studentObject,
  timeLimitInMinutes
) {
  try {
    if (!studentObject || !studentObject.id) {
      console.log("Invalid student object provided.");
      return;
    }

    const studentExamAttempt = await fetchStudentExamAttempt(
      studentObject.id,
      examId
    );

    if (!studentExamAttempt) {
      console.log(
        `No existing exam attempt found for student ${studentObject.id} and exam ${examId}. Cannot increase time.`
      );
      return;
    }

    studentExamAttempt.isFinished = false;
    studentExamAttempt.endDatetime = DateTime.fromISO(
      studentExamAttempt.endDatetime
    ).plus({
      seconds: timeLimitInMinutes * 60,
    });

    await addStudentExamAttempt(studentObject.id, examId, studentExamAttempt);

    console.log(
      `Successfully increased time for student ${studentObject.id} on exam ${examId} by ${timeLimitInMinutes} minutes.`
    );
  } catch (error) {
    console.error("❌ Operation failed:", error);
  }
}

// Terminal interaction function
async function runTerminalTool() {
  try {
    await connectRedis();

    let studentEmail;
    let student;

    while (!student) {
      studentEmail = await new Promise((resolve) => {
        rl.question("Enter student email: ", (answer) => {
          resolve(answer.trim());
        });
      });

      student = await fetchStudentLogin(studentEmail);
      if (!student) {
        console.log(
          `Student with email "${studentEmail}" not found. Please try again.`
        );
      }
    }

    console.log(
      `\nFound student: ${student.name || student.email} (ID: ${student.id})`
    );

    const studentExams = await fetchStudentExams(student.id);

    if (!studentExams || Object.keys(studentExams).length === 0) {
      console.log(
        `No exams found for student ${student.name || student.email}.`
      );
      return;
    }

    console.log("\nAvailable Exams for this student:");
    const examChoices = [];
    let i = 1;
    for (const examId in studentExams) {
      const exam = studentExams[examId];
      if (exam && exam.title && exam.id) {
        console.log(`${i}. ${exam.title} (ID: ${exam.id})`);
        examChoices.push({ index: i, examId: exam.id, title: exam.title });
        i++;
      }
    }

    let selectedExamChoice;
    let selectedExam;
    while (!selectedExam) {
      const choiceInput = await new Promise((resolve) => {
        rl.question("Enter the number of the exam to select: ", (answer) => {
          resolve(parseInt(answer.trim(), 10));
        });
      });

      selectedExamChoice = examChoices.find(
        (choice) => choice.index === choiceInput
      );

      if (selectedExamChoice) {
        selectedExam = studentExams[selectedExamChoice.examId];
        if (!selectedExam) {
          console.log(
            "Error: Selected exam data is missing. Please try again."
          );
          selectedExamChoice = null; // Reset
        }
      } else {
        console.log(
          "Invalid selection. Please enter a valid number from the list."
        );
      }
    }

    console.log(`\nYou selected: ${selectedExam.title}`);

    let timeToAdd;
    while (true) {
      const timeInput = await new Promise((resolve) => {
        rl.question("Enter amount of time to add (in minutes): ", (answer) => {
          resolve(answer.trim());
        });
      });

      timeToAdd = parseInt(timeInput, 10);

      if (isNaN(timeToAdd) || timeToAdd <= 0) {
        console.log(
          "Invalid input. Please enter a positive number for minutes."
        );
      } else {
        break;
      }
    }

    await increaseStudentExamTime(selectedExam.id, student, timeToAdd);
  } catch (error) {
    console.error("An error occurred during execution:", error);
  } finally {
    await disconnectRedis();
    rl.close(); // Close the readline interface
  }
}

// Start the terminal tool
runTerminalTool();
