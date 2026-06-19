FROM node:22

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHON_BIN=/opt/venv/bin/python
ENV PATH="/opt/venv/bin:${PATH}"

COPY package*.json ./
RUN npm install

COPY python_processors/requirements.txt ./python_processors/requirements.txt
RUN python3 -m venv /opt/venv \
    && pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r python_processors/requirements.txt

COPY . .

EXPOSE 5020
CMD ["node", "index.js"]
