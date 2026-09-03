# AutoSAR AI

AutoSAR AI is an AML case-management application that evaluates transaction cases with a dataset-trained machine-learning model and uses Gemini to generate a Suspicious Activity Report (SAR) narrative.

The application has:

- A React and Vite frontend in `client/`
- An Express REST API in `server/`
- A local MySQL persistence layer
- A case-level Random Forest AML classifier
- Gemini-powered SAR narrative generation with a local fallback
- An immutable audit trail for case, model, and narrative events

## Prerequisites

- Node.js 18 or later
- npm 9 or later
- MySQL 8 or later
- Python 3.10 or later for model training
- Python packages: `pandas` and `scikit-learn`
- A Gemini API key for Gemini-generated narratives

## Installation

Install frontend and backend dependencies:

```powershell
npm install --prefix client
npm install --prefix server
```

Create the server environment file:

```powershell
Copy-Item server/.env.example server/.env
```

Set the MySQL values and `GEMINI_API_KEY` in `server/.env`. The API key is optional; without it, the server creates a local template-based SAR.

## Database

```powershell
npm run db:init
```

## Run The Application

Start the API and frontend in separate terminals:

```powershell
npm run dev:server
npm run dev:client
```

Open [http://localhost:5173](http://localhost:5173).

- Frontend: `http://localhost:5173`
- API: `http://localhost:5000`
- Health check: `http://localhost:5000/api/health`

The Vite development server proxies `/api` requests to Express.

## Machine-Learning Model

The runtime model is exported to `server/src/core/rules/ml_tree.json` by `ml_model/train_tree.py`.

The trainer uses the supplied AML transaction dataset, defaulting to `HI-Small_Trans.csv`. It groups transactions by sender bank and account, labels a group positive when one or more transactions are labeled `Is Laundering`, and trains an 80-tree Random Forest classifier.

The model uses these case-level features:

- Transaction count
- Total, average, maximum, and standard deviation of transaction amounts
- Number of unique recipients and recipient banks
- Cross-bank transfer ratio
- Cash, wire, ACH, and night-transaction ratios

The model returns a laundering probability. The application converts that probability to a score from 0 to 100 and assigns the model classification:

- Below 25: No Action Required - Low Risk
- 25 to 49: Enhanced Monitoring Required
- 50 to 74: SAR Required - High Risk
- 75 and above: SAR Required - Critical Risk

Risk score and classification come from the model. The application does not add country, income, threshold, velocity, or hand-written weighted rules to the model score.

Retrain using the default dataset:

```powershell
python ml_model/train_tree.py
```

Choose another compatible dataset in `ml_model/`:

```powershell
$env:TRAINING_DATASET = "HI-Medium_Trans.csv"
python ml_model/train_tree.py
```

The public dataset contains transaction-level laundering labels, so the trainer aggregates those labels by sender account to create case-level training examples. Customer income, PAN, address, and counterparty country are not model features because those fields are not present in the training data.

## Sample Data

The dashboard can download `client/public/sample-customers.json`. The sample demonstrates a model-recognized pattern with two ACH transactions, two recipients, and transfers involving two banks.

To test it, open the dashboard, select **Upload Data**, and upload `client/public/sample-customers.json`. The generated case shows the model score, explanations, SAR draft, and audit trail.

## Gemini SAR Generation

Gemini is used for narrative generation only. The model score and classification are calculated before the SAR prompt is sent.

The current default model is `gemini-3.6-flash`. The server retries temporary Gemini `429` and `5xx` failures before using the local fallback. Each generation records whether the source was `gemini` or `fallback` in the audit trail.

## Project Commands

| Command | Description |
| --- | --- |
| `npm run dev:client` | Start the Vite frontend |
| `npm run dev:server` | Start the Express API with nodemon |
| `npm run build` | Build the frontend |
| `npm run start` | Start the API without nodemon |
| `npm run db:init` | Create the MySQL database and tables |
| `python ml_model/train_tree.py` | Train and export the AML model |

## Security Notes

- Never commit `server/.env` or API keys.
- Use `server/.env.example` as the shareable configuration template.
- The included sample data is synthetic.
- ML predictions are decision-support output and require review by qualified compliance personnel before regulatory filing.
