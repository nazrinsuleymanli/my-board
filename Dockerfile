# --- 1) build the React app ---
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# --- 2) Python API that also serves the built app ---
FROM python:3.13-slim
WORKDIR /app
# ffmpeg: turns iPhone .mov/HEVC videos into mp4 that plays everywhere + makes card poster frames
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY --from=web /web/dist ./static
ENV DATA_DIR=/data STATIC_DIR=/app/static
VOLUME /data
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
