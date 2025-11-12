#!/bin/bash

set -e

TEX_FILE="report-v2.tex"
BASE_NAME="${TEX_FILE%.tex}"
CLEAN_FILES=("*.aux" "*.log" "*.toc" "*.out" "*.bbl" "*.blg" "*.fdb_latexmk" "*.fls" "*.synctex.gz")
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

clean_aux() {
    print_info "Cleaning auxiliary files..."
    for pattern in "${CLEAN_FILES[@]}"; do
        find . -maxdepth 1 -name "$pattern" -type f -delete 2>/dev/null || true
    done
    print_info "Cleanup complete."
}

if ! command -v pdflatex &> /dev/null; then
    print_error "pdflatex is not installed. Please install a LaTeX distribution (e.g., MacTeX, TeX Live)."
    exit 1
fi

HAS_BIBTEX=false
if command -v bibtex &> /dev/null; then
    HAS_BIBTEX=true
fi

if [ "$1" == "clean" ]; then
    clean_aux
    if [ -f "${BASE_NAME}.pdf" ]; then
        rm -f "${BASE_NAME}.pdf"
        print_info "Removed ${BASE_NAME}.pdf"
    fi
    exit 0
fi

if [ ! -f "$TEX_FILE" ]; then
    print_error "LaTeX file '$TEX_FILE' not found in current directory."
    exit 1
fi

if [ -f "generate-diagrams.sh" ] && [ -d "diagrams" ]; then
    print_info "Generating diagrams..."
    if ./generate-diagrams.sh; then
        print_info "Diagrams generated successfully."
    else
        print_warn "Diagram generation had issues, continuing anyway..."
    fi
fi

print_info "Compiling LaTeX document: $TEX_FILE"

print_info "Running pdflatex (pass 1/3)..."
if pdflatex -interaction=nonstopmode -file-line-error "$TEX_FILE" > /dev/null 2>&1; then
    print_info "First pass completed."
else
    print_warn "First pass had warnings. Check ${BASE_NAME}.log for details."
fi

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

print_info "Running pdflatex (pass 2/3)..."
if pdflatex -interaction=nonstopmode -file-line-error "$TEX_FILE" > /dev/null 2>&1; then
    print_info "Second pass completed."
else
    print_warn "Second pass had warnings."
fi

print_info "Running pdflatex (pass 3/3)..."
if pdflatex -interaction=nonstopmode -file-line-error "$TEX_FILE" > /dev/null 2>&1; then
    print_info "Third pass completed."
else
    print_warn "Third pass had warnings."
fi

if [ -f "${BASE_NAME}.pdf" ]; then
    print_info "PDF successfully generated: ${BASE_NAME}.pdf"
    PDF_SIZE=$(du -h "${BASE_NAME}.pdf" | cut -f1)
    print_info "PDF file size: $PDF_SIZE"
else
    print_error "PDF generation failed. Check ${BASE_NAME}.log for errors."
    exit 1
fi

read -p "$(echo -e ${YELLOW}Clean auxiliary files? [y/N]: ${NC})" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    clean_aux
fi

print_info "Build complete!"

