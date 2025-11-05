# 🔐 Environment Variables Setup

This guide explains how to set up your environment variables for the Morphit application.

## 📋 Quick Setup

1. **Copy the template:**
   ```bash
   cp .env.example .env
   ```

2. **Fill in your actual values** in the `.env` file

3. **Never commit** the `.env` file to version control

## 🔑 Required Environment Variables

### Database
- `DATABASE_URL`: PostgreSQL connection string (includes Neon DB URL)

### Authentication
- `JWT_SECRET`: Secret key for JWT token signing (use a long, random string)

### Supabase
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous/public key
- `VITE_SUPABASE_URL`: Same as above (for frontend)
- `VITE_SUPABASE_ANON_KEY`: Same as above (for frontend)

### Email (SMTP)
- `SMTP_HOST`: SMTP server (default: smtp.gmail.com)
- `SMTP_PORT`: SMTP port (default: 587)
- `SMTP_USER`: Your email address
- `SMTP_PASSWORD`: Your email app password

### AI Services
- `OPENAI_API_KEY`: Your OpenAI API key for AI features

### Application
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 5005)

## 🚨 Security Notes

- **JWT_SECRET**: Use a minimum 32-character random string
- **Never share** your `.env` file
- **Use different secrets** for each environment (dev/staging/prod)
- **Rotate secrets** periodically for security

## 🔍 Verification

After setting up your `.env` file, run:
```bash
npm run dev
```

The application should start without environment variable errors.