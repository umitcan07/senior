#!/bin/bash

# LaTeX to PDF compilation script
# Usage: ./build.sh [clean]

set -e  # Exit on error

# Configuration
TEX_FILE="report-v2.tex"
BASE_NAME="${TEX_FILE%.tex}"
CLEAN_FILES=("*.aux" "*.log" "*.toc" "*.out" "*.bbl" "*.blg" "*.fdb_latexmk" "*.fls" "*.synctex.gz")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to clean auxiliary files
clean_aux() {
    print_info "Cleaning auxiliary files..."
    for pattern in "${CLEAN_FILES[@]}"; do
        find . -maxdepth 1 -name "$pattern" -type f -delete 2>/dev/null || true
    done
    print_info "Cleanup complete."
}

# Check if pdflatex is available
if ! command -v pdflatex &> /dev/null; then
    print_error "pdflatex is not installed. Please install a LaTeX distribution (e.g., MacTeX, TeX Live)."
    exit 1
fi

# Check if bibtex is available (for bibliography)
HAS_BIBTEX=false
if command -v bibtex &> /dev/null; then
    HAS_BIBTEX=true
fi

# Handle clean option
if [ "$1" == "clean" ]; then
    clean_aux
    if [ -f "${BASE_NAME}.pdf" ]; then
        rm -f "${BASE_NAME}.pdf"
        print_info "Removed ${BASE_NAME}.pdf"
    fi
    exit 0
fi

# Check if TEX file exists
if [ ! -f "$TEX_FILE" ]; then
    print_error "LaTeX file '$TEX_FILE' not found in current directory."
    exit 1
fi

print_info "Compiling LaTeX document: $TEX_FILE"

# First pass: Generate aux files, TOC, etc.
print_info "Running pdflatex (pass 1/3)..."
if pdflatex -interaction=nonstopmode -file-line-error "$TEX_FILE" > /dev/null 2>&1; then
    print_info "First pass completed."
else
    print_warn "First pass had warnings. Check ${BASE_NAME}.log for details."
fi

# Check if bibliography exists and run bibtex
if [ "$HAS_BIBTEX" == true ] && [ -f "references.bib" ]; then
    print_info "Running bibtex for bibliography..."
    if bibtex "$BASE_NAME" > /dev/null 2>&1; then
        print_info "Bibliography processed."
    else
        print_warn "Bibliography processing had warnings."
    fi
elif [ -f "references.bib" ]; then
    print_warn "Bibliography file found but bibtex is not available. Skipping bibliography."
fi

# Second pass: Update references, TOC, etc.
print_info "Running pdflatex (pass 2/3)..."
if pdflatex -interaction=nonstopmode -file-line-error "$TEX_FILE" > /dev/null 2>&1; then
    print_info "Second pass completed."
else
    print_warn "Second pass had warnings."
fi

# Third pass: Finalize all references
print_info "Running pdflatex (pass 3/3)..."
if pdflatex -interaction=nonstopmode -file-line-error "$TEX_FILE" > /dev/null 2>&1; then
    print_info "Third pass completed."
else
    print_warn "Third pass had warnings."
fi

# Check if PDF was generated
if [ -f "${BASE_NAME}.pdf" ]; then
    print_info "PDF successfully generated: ${BASE_NAME}.pdf"
    
    # Show PDF file size
    PDF_SIZE=$(du -h "${BASE_NAME}.pdf" | cut -f1)
    print_info "PDF file size: $PDF_SIZE"
    
    # Optionally open the PDF (uncomment if desired)
    # if command -v open &> /dev/null; then
    #     open "${BASE_NAME}.pdf"
    # fi
else
    print_error "PDF generation failed. Check ${BASE_NAME}.log for errors."
    exit 1
fi

# Ask if user wants to clean auxiliary files
read -p "$(echo -e ${YELLOW}Clean auxiliary files? [y/N]: ${NC})" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    clean_aux
fi

print_info "Build complete!"

