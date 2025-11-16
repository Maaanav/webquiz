// frontend/src/components/QuizPage.js
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/QuizPage.css';
import backgroundVideo from '../assets/videos/quizbg.mp4';

function QuizPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const quizId = params.get('quiz_id');

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timer, setTimer] = useState(30);
  const [quizCompleted, setQuizCompleted] = useState(false);

  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoading(true);
      try {
        const url = quizId ? `http://localhost:5001/api/questions?quiz_id=${quizId}` : 'http://localhost:5001/api/questions';
        const response = await axios.get(url);
        if (response.data.message && (response.data.questions && response.data.questions.length > 0)) {
          setQuestions(response.data.questions);
        } else {
          alert('No questions available.');
          navigate('/');
        }
      } catch (error) {
        console.error('Error fetching questions:', error);
        alert('Failed to fetch quiz questions.');
        navigate('/');
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, [navigate, quizId]);

  const handleAnswerChange = (e, index) => {
    setAnswers({
      ...answers,
      [index]: e.target.value
    });
  };

  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();
    try {
      const payload = { answers };
      // attach current user if available
      const rawUser = localStorage.getItem('quiz_current_user');
      if (rawUser) {
        try { payload.user = JSON.parse(rawUser); } catch (err) { /* ignore */ }
      }

      if (quizId) payload.quiz_id = Number(quizId);

      setIsLoading(true);
      // POST to backend submit (note /api prefix)
      const response = await axios.post('http://localhost:5001/api/submit', payload);

      // backend sends { score, total, detailed, saved_result } or saved_result included
      const resultObj = response.data;

      // Save full server response to localStorage as fallback
      try {
        localStorage.setItem('lastQuizResult', JSON.stringify(resultObj));
      } catch (err) {
        console.warn('Could not save lastQuizResult to localStorage', err);
      }

      if (resultObj && (resultObj.score !== undefined || resultObj.total !== undefined)) {
        setScore(resultObj.score ?? 0);
        setTimer(0);
        setQuizCompleted(true);
        navigate('/results');
      } else {
        alert('Failed to submit quiz.');
      }
    } catch (error) {
      console.error('Error submitting quiz:', error);
      alert('Failed to submit quiz.');
    } finally {
      setIsLoading(false);
    }
  }, [answers, quizId, navigate]);

  const nextQuestion = useCallback((e) => {
    if (e) e.preventDefault();

    if (!answers.hasOwnProperty(currentQuestion)) {
      setAnswers({
        ...answers,
        [currentQuestion]: 'skipped question'
      });
    }

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setTimer(30);
    } else {
      handleSubmit(e);
    }
  }, [currentQuestion, answers, questions.length, handleSubmit]);

  useEffect(() => {
    if (quizCompleted || currentQuestion >= questions.length) return;

    if (timer > 0) {
      const countdown = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(countdown);
    } else {
      nextQuestion();
    }
  }, [timer, currentQuestion, quizCompleted, questions.length, nextQuestion]);

  const handleGoHome = () => {
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="quiz-container">
        <video className="quiz-background-video" autoPlay muted loop>
          <source src={backgroundVideo} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="quiz-content">
          <div className="loading">
            <div className="spinner"></div> Loading Questions...
          </div>
        </div>
      </div>
    );
  }

  if (!isLoading && questions.length === 0) {
    return (
      <div className="quiz-container">
        <video className="quiz-background-video" autoPlay muted loop>
          <source src={backgroundVideo} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="quiz-content">
          <div className="error">No questions available.</div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];

  if (!currentQ) {
    return (
      <div className="quiz-container">
        <video className="quiz-background-video" autoPlay muted loop>
          <source src={backgroundVideo} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="quiz-content">
          <div className="error">Question not found.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-container">
      <video className="quiz-background-video" autoPlay muted loop>
        <source src={backgroundVideo} type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      <div className="quiz-content">
        {!quizCompleted ? (
          <div className="quiz-form">
            <div className="progress-indicator">
              Question {currentQuestion + 1} of {questions.length}
            </div>

            <div className="timer">
              Time Remaining: {timer} sec
            </div>
            <div className="question-block">
              <form onSubmit={handleSubmit}>
                <p className="question-text">{currentQ.question}</p>
                <div className="options-grid">
                  {currentQ.options.map((option, optIndex) => (
                    <div
                      key={optIndex}
                      className={`option-button ${answers[currentQuestion] === option ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        id={`option-${currentQuestion}-${optIndex}`}
                        name={`question-${currentQuestion}`}
                        value={option}
                        onChange={(e) => handleAnswerChange(e, currentQuestion)}
                        checked={answers[currentQuestion] === option}
                        required
                      />
                      <label htmlFor={`option-${currentQuestion}-${optIndex}`}>
                        {option}
                      </label>
                    </div>
                  ))}
                </div>

                <div className="navigation-buttons">
                  {currentQuestion < questions.length - 1 ? (
                    <button type="button" onClick={nextQuestion} className="next-button">Next</button>
                  ) : (
                    <button type="button" onClick={handleSubmit} className="submit-button">Submit</button>
                  )}
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="result-section">
            <h2 className="score-display">Your Score: {score}/{questions.length}</h2>
            <div className="result-actions">
              <button onClick={handleGoHome} className="go-home-button">Go to Home</button>
              <button onClick={() => navigate('/results')} className="view-result-button">View Result</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuizPage;