# Nexus Dashboard

A modern, feature-rich personal dashboard built with Next.js and React.

## Features

- **Project Management**: Manage your personal projects with detailed boards.
- **Finance Tracking**: Track stocks, currencies, and cryptocurrencies with live data.
- **News Aggregator**: Stay updated with the latest news from your favorite sources.
- **System Monitoring**: Monitor your system's CPU and Memory usage (local only).
- **File System Viewer**: Browse and manage files on your local system.
- **AI Integration**: Powered by Google AI Gemini.

## Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database**: [MongoDB](https://www.mongodb.com/)
- **API**: [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [MongoDB](https://www.mongodb.com/try/download/community) (or access to MongoDB Atlas)

### Installation

1. **Clone the repository** (if you haven't already)

   ```bash
   git clone <repository-url>
   cd Nexus-Dashboard
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Variables**
   Copy the `.env.example` file to `.env` and fill in your credentials.

   ```bash
   cp .env.example .env
   ```

   **.env file content:**

   ```env
   MONGODB_URI="<your_mongodb_connection_string>"
   GOOGLE_AI_API_KEY="<your_google_ai_gemini_api_key>"
   NEXTAUTH_URL="http://localhost:3000"
   ```

4. **Run the development server**

   ```bash
   npm run dev
   ```

5. **Open the app**
   Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

## Usage

### Authentication

To use the dashboard, you need to log in. 
- **Username**: admin
- **Password**: [PASSWORD]

### Login Page

The login page is located at `/login`.

## Project Structure

```
Nexus-Dashboard/
├── app/                  # Next.js App Router pages
├── components/           # React components
├── lib/                  # Utility functions and helpers
├── middleware/           # Middleware for authentication
├── models/               # Mongoose database models
├── public/               # Static assets
├── styles/               # Global styles
├── .env.example          # Environment variable template
└── ...                   # Config files
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues or questions, please open an issue in the repository.

---

Made with ❤️ by Lucca
