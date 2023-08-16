-- EthPhunk Table
CREATE TABLE EthPhunk (
    id SERIAL PRIMARY KEY,
    createdAt TIMESTAMP,
    creator VARCHAR(255),
    owner VARCHAR(255),
    hashId VARCHAR(255) UNIQUE,
    blockHash VARCHAR(255),
    txIndex INTEGER,
    sha VARCHAR(255),
    phunkId INTEGER,
    data TEXT,
    ethscriptionNumber INTEGER
);

-- EthPhunkTransfer Table
CREATE TABLE EthPhunkTransfer (
    id SERIAL PRIMARY KEY,
    createdAt TIMESTAMP,
    hashId VARCHAR(255) UNIQUE,
    from VARCHAR(255),
    to VARCHAR(255),
    blockHash VARCHAR(255),
    txIndex INTEGER,
    txHash VARCHAR(255) UNIQUE,
    phunkId INTEGER REFERENCES EthPhunk(id),
    blockNumber INTEGER
);

-- Sha Table
CREATE TABLE Sha (
    id SERIAL PRIMARY KEY,
    sha VARCHAR(255) UNIQUE,
    phunkId INTEGER REFERENCES EthPhunk(id)
);

-- User Table
CREATE TABLE User (
    id VARCHAR(255) PRIMARY KEY,
    createdAt TIMESTAMP,
    address VARCHAR(255)
);

-- Indexes
CREATE INDEX idx_ethphunk_hashId ON EthPhunk(hashId);
CREATE INDEX idx_ethphunktransfer_hashId ON EthPhunkTransfer(hashId);
CREATE INDEX idx_sha_sha ON Sha(sha);
