FROM python:3.11-slim

WORKDIR /app

COPY . /app

EXPOSE 8000

ENV PORT=8000
ENV PYTHONUNBUFFERED=1

CMD ["python", "app.py"]
