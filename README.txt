TECH SOURCE RRB RESULT ANALYZER — URL BACKEND

1) Node.js 18+ install करें.
2) इस folder में terminal खोलें.
3) चलाएँ: npm start
4) Browser में खोलें: http://localhost:3000
5) Digialm response-sheet URL paste करें और Analyze Result दबाएँ.

यह backend केवल digialm.com और उसके subdomains को fetch करने देता है.
20 MB response limit, 20 second timeout और basic per-IP rate limit लगा है.

अगर frontend किसी दूसरे domain पर host है:
- Analyzer में ⚙ Backend खोलें.
- Backend API URL दें: https://YOUR-BACKEND-DOMAIN/api/fetch
- Save करें.

महत्वपूर्ण: backend को public internet पर deploy करते समय HTTPS और अपने hosting provider की सुरक्षा settings का उपयोग करें.
