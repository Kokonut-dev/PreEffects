#!/usr/bin/env bash
# Idempotent helper script to provision GitHub Milestones, Labels, and Stage Issues via `gh` CLI.
set -euo pipefail

REPO="${1:-Kokonut-dev/PreEffects}"

echo "Provisioning labels and milestones for ${REPO}..."

declare -a LABELS=(
  "stage:planning:#0E8A16:Planning & Architecture artefacts"
  "stage:design:#FBCA04:UI/UX Mockups, Wireframes & Design System"
  "stage:research:#1D76DB:Competitive, Technical & UX Research"
  "stage:core:#D93F0B:Core Engine & Studio Implementation"
  "stage:qol-aesthetics:#5319E7:Quality of Life & Visual Polish"
  "stage:perf:#006B75:Profiling & Performance Optimisation"
  "stage:qa:#B60205:Testing, Bug Fixes & Verification"
)

for entry in "${LABELS[@]}"; do
  IFS=":" read -r name color desc <<< "$entry"
  gh label create "$name" --repo "$REPO" --color "${color#\#}" --description "$desc" --force
done

declare -a MILESTONES=(
  "Stage 1: Planning"
  "Stage 2: Initial Mock-Up"
  "Stage 3: Research"
  "Stage 4: Revised Mock-Up"
  "Stage 5: Functionality Testing"
  "Stage 6: Functionality Creation"
  "Stage 7: Quality of Life Additions"
  "Stage 8: Aesthetics"
  "Stage 9: Optimisation Round 1"
  "Stage 10: Bug Fixes Round 1"
  "Stage 11: Reimplementation"
  "Stage 12: Optimisation Round 2"
  "Stage 13: Bug Fixes Round 2"
  "Stage 14+: Iterative Improvement & Final Validation"
)

for ms in "${MILESTONES[@]}"; do
  gh api "repos/${REPO}/milestones" -f title="$ms" -f state="open" >/dev/null 2>&1 || true
done

echo "GitHub Milestones and Labels configured."
