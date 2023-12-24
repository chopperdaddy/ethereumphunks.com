#!/bin/bash
psql -h db.kcbuycbhynlmsrvoegzp.supabase.co -p 5432 -d postgres -U postgres -c "\COPY users_goerli FROM './users_goerli.csv' WITH (FORMAT csv, HEADER);"

psql -h db.kcbuycbhynlmsrvoegzp.supabase.co -p 5432 -d postgres -U postgres -c "\COPY phunk_shas FROM './phunk_shas.csv' WITH (FORMAT csv, HEADER);"

psql -h db.kcbuycbhynlmsrvoegzp.supabase.co -p 5432 -d postgres -U postgres -c "\COPY ethscriptions_goerli FROM './ethscriptions_goerli.csv' WITH (FORMAT csv, HEADER);"

psql -h db.kcbuycbhynlmsrvoegzp.supabase.co -p 5432 -d postgres -U postgres -c "\COPY events_goerli FROM './events_goerli.csv' WITH (FORMAT csv, HEADER);"

psql -h db.kcbuycbhynlmsrvoegzp.supabase.co -p 5432 -d postgres -U postgres -c "\COPY listings_goerli FROM './listings_goerli.csv' WITH (FORMAT csv, HEADER);"

psql -h db.kcbuycbhynlmsrvoegzp.supabase.co -p 5432 -d postgres -U postgres -c "\COPY bids_goerli FROM './bids_goerli.csv' WITH (FORMAT csv, HEADER);"

psql -h db.kcbuycbhynlmsrvoegzp.supabase.co -p 5432 -d postgres -U postgres -c "\COPY auctions_goerli FROM './auctions_goerli.csv' WITH (FORMAT csv, HEADER);"
