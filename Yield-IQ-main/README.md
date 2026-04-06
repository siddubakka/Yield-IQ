# YieldIQ — AI-Powered Agricultural Marketplace

YieldIQ is an intelligent agricultural trading platform built to eliminate intermediaries and maximize profits for Indian farmers. It features real-time marketplace tracking, direct corporate buyer negotiations, and AI-powered crop insights.

## Project Structure
- `index.html` / `style.css` / `app.js` — Frontend SPA (Single Page Application)
- `backend/` — Flask REST API, SQLite database, and authentication logic

## How to Run Locally

To get this running on your local machine, you need to start **both** the backend and the frontend servers.

### 1. Setup & Start the Backend
You will need Python installed on your system.

1. Open a terminal and navigate into the backend folder:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   - **Windows:** `python -m venv venv` then `.\venv\Scripts\activate`
   - **Mac/Linux:** `python3 -m venv venv` then `source venv/bin/activate`
3. Install dependencies:
   ```bash
   pip install flask flask-cors bcrypt requests pyjwt python-dotenv
   ```
4. Run the API server:
   ```bash
   python app.py
   ```
*(The backend should now be running on http://127.0.0.1:5000)*

### 2. Start the Frontend
Since the application uses local modules/APIs, you cannot just double-click the `index.html`. You need to serve it.

1. Open a **new, separate terminal** in the project's root folder (`YieldIQ1`).
2. Run the simple python server script:
   ```bash
   python serve.py
   ```
3. Open your browser and go to: **http://127.0.0.1:8080**

You can now click the fake Google/Facebook logins to access the full dashboard!
