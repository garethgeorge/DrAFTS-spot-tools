-- Use /i <path to this file> to import on your sip database

DROP TABLE predictions;
DROP TABLE history;

CREATE TABLE history (
    region CHAR(20) NOT NULL,
    az CHAR(20) NOT NULL, 
    insttype CHAR(20) NOT NULL, 
    ts TIMESTAMP NOT NULL,
    spotprice DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (region, az, insttype, ts)
);

CREATE INDEX history_sort_by_timestamp ON history (ts ASC);

CREATE TABLE predictions (
    region CHAR(20) NOT NULL,
    az CHAR(20) NOT NULL,
    insttype CHAR(20) NOT NULL,
    ts TIMESTAMP NOT NULL,
    val DOUBLE PRECISION NOT NULL,
    pred DOUBLE PRECISION NOT NULL,
    succ FLOAT NOT NULL,
    PRIMARY KEY (region, az, insttype, ts)
);

CREATE INDEX predictions_sort_by_timestamp ON predictions (ts ASC);
