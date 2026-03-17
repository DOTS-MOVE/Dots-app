FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Make entrypoint script executable
RUN chmod +x entrypoint.sh

# Use PORT environment variable provided by Cloud Run (defaults to 8080)
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["./entrypoint.sh"]

