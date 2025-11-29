import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/HomePage.css";
import fileUploadBackground from "../assets/images/fileuploadbg.jpg";
import quizinfoBackground from "../assets/images/infoimage.jpg";
import backgroundVideo from "../assets/videos/quizbgvideo.mp4";

function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (location.hash === "#upload") {
      setTimeout(() => {
        const el = document.getElementById("file-upload-section");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
    }
    if (location.hash === "#info") {
      setTimeout(() => {
        const el = document.getElementById("info-section");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
    }
  }, [location]);

  const handleFileChange = (e) => {
    setFile(e.target.files && e.target.files[0]);
  };

  const handleFileUpload = async () => {
    if (!file) {
      alert("Please select a PDF file to upload.");
      return;
    }
    setIsLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post("import.meta.env.VITE_API_BASE_URL/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      console.log("Upload Response:", response.data);
      if (response.data.message && response.data.message.includes("questions generated")) {
        const quizId = response.data.quiz_id;
        if (quizId) navigate(`/quiz?quiz_id=${quizId}`);
        else navigate("/quiz");
      } else {
        alert("Failed to upload file and generate questions.");
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("An error occurred during file upload. Check backend logs.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="home-container">

      <div className="video-container">
        <video className="background-video" autoPlay muted loop>
          <source src={backgroundVideo} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        <div className="video-content">
          <h1 className="title">Welcome to QuizWeb</h1>
          <p className="description">The ultimate quiz experience!</p>
        </div>
      </div>

      <div
        id="info-section"
        className="info-section"
        style={{
          backgroundImage: `url(${quizinfoBackground})`,
        }}
      >
        <div className="inner">
          <h2>About QuizWeb</h2>
          <p>
            QuizWeb combines artificial intelligence with education to revolutionize the way quizzes are made.
            By analyzing the content of any uploaded PDF, our AI automatically understands context, identifies important topics, and crafts meaningful multiple-choice questions with accurate answers.
          </p>
        </div>
      </div>

      <div
        id="file-upload-section"
        className="file-upload-section"
        style={{
          backgroundImage: `url(${fileUploadBackground})`,
        }}
      >
        <div className="inner">
          <h2>Upload your PDF</h2>
          <input type="file" accept=".pdf" onChange={handleFileChange} />
          <button onClick={handleFileUpload} disabled={isLoading}>
            {isLoading ? (
              <>
                <div className="spinner" /> Uploading...
              </>
            ) : (
              "Upload"
            )}
          </button>
        </div>
      </div>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-left">
            <h3 className="footer-logo">QuizWeb</h3>
            <p className="footer-desc">
              QuizWeb is an <strong>AI-powered quiz generation platform</strong> that transforms your PDFs into interactive quizzes instantly.
            </p>
          </div>
          <div className="footer-center">
            <h4>Quick Links</h4>
            <ul className="footer-links">
              <li><a href="/">Home</a></li>
              <li><a href="/#info">About</a></li>
              <li><a href="/admin">Admin</a></li>
              <li><a href="/results">Results</a></li>
              <li><a href="/login">Login</a></li>
            </ul>
          </div>
          <div className="footer-right">
            <h4>Contact Us</h4>
            <p>Email: <a href="mailto:quizweb.support@gmail.com">quizweb.support@gmail.com</a></p>
            <p>Developed by: <strong>Team QuizWeb</strong></p>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} QuizWeb. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
