#!/bin/bash

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
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

DIAGRAMS_DIR="diagrams"
OUTPUT_DIR="images"

if [ ! -d "$DIAGRAMS_DIR" ]; then
    print_error "Diagrams directory '$DIAGRAMS_DIR' not found."
    exit 1
fi

mkdir -p "$OUTPUT_DIR"
print_info "Generating diagrams from $DIAGRAMS_DIR/..."

if ! command -v java &> /dev/null; then
    print_error "Java is required to run PlantUML."
    print_info "Please install Java (OpenJDK or Oracle JDK)."
    exit 1
fi

PLANTUML_JAR=""
POSSIBLE_PATHS=(
    "$HOME/.local/bin/plantuml.jar"
    "$HOME/plantuml.jar"
    "./plantuml.jar"
    "/usr/local/bin/plantuml.jar"
    "/opt/plantuml/plantuml.jar"
)

for path in "${POSSIBLE_PATHS[@]}"; do
    if [ -f "$path" ]; then
        PLANTUML_JAR="$path"
        break
    fi
done

if [ -z "$PLANTUML_JAR" ]; then
    print_warn "PlantUML jar not found in common locations."
    print_info "Attempting to download PlantUML..."
    
    PLANTUML_DIR="$HOME/.local/bin"
    mkdir -p "$PLANTUML_DIR"
    PLANTUML_JAR="$PLANTUML_DIR/plantuml.jar"
    
    if command -v wget &> /dev/null; then
        wget -q https://github.com/plantuml/plantuml/releases/download/v1.2024.3/plantuml-1.2024.3.jar -O "$PLANTUML_JAR"
    elif command -v curl &> /dev/null; then
        curl -sL https://github.com/plantuml/plantuml/releases/download/v1.2024.3/plantuml-1.2024.3.jar -o "$PLANTUML_JAR"
    else
        print_error "Neither wget nor curl found. Cannot download PlantUML."
        print_info "Please download PlantUML manually:"
        print_info "  wget https://github.com/plantuml/plantuml/releases/download/v1.2024.3/plantuml-1.2024.3.jar -O $PLANTUML_JAR"
        exit 1
    fi
    
    if [ ! -f "$PLANTUML_JAR" ]; then
        print_error "Failed to download PlantUML jar."
        exit 1
    fi
    
    print_info "Downloaded PlantUML to $PLANTUML_JAR"
fi

GENERATED_COUNT=0
for puml_file in "$DIAGRAMS_DIR"/*.puml; do
    if [ ! -f "$puml_file" ]; then
        continue
    fi
    
    filename=$(basename "$puml_file" .puml)
    output_file="$OUTPUT_DIR/${filename}.png"
    
    print_info "Generating $filename.png from $(basename $puml_file)..."
    
    if java -jar "$PLANTUML_JAR" -tpng -Sdpi=300 -o "../$OUTPUT_DIR" "$puml_file" 2>&1 | grep -v "java.io.IOException" | grep -v "dot not found" | grep -v "Error:" | grep -q .; then
        if [ -f "$output_file" ]; then
            print_info "Successfully generated $output_file"
            GENERATED_COUNT=$((GENERATED_COUNT + 1))
        elif [ -f "$OUTPUT_DIR/${filename}.png" ]; then
            print_info "Successfully generated $output_file"
            GENERATED_COUNT=$((GENERATED_COUNT + 1))
        else
            print_warn "Generated but output file not found for $filename"
        fi
    else
        if [ -f "$output_file" ]; then
            print_info "Successfully generated $output_file"
            GENERATED_COUNT=$((GENERATED_COUNT + 1))
        else
            print_warn "Failed to generate $filename.png"
        fi
    fi
done

if [ $GENERATED_COUNT -eq 0 ]; then
    print_warn "No diagrams were generated. Check if .puml files exist in $DIAGRAMS_DIR/"
else
    print_info "Successfully generated $GENERATED_COUNT diagram(s)"
fi
