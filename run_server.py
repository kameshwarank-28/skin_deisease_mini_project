import os
import sys

sys.path.insert(0, os.path.abspath("."))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=False, access_log=True)

