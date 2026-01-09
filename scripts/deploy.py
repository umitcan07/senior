#!/usr/bin/env python3
"""
Interactive deployment script for RunPod containers.
Handles version bumping, building, tagging, and pushing of Docker images.
Verified for compatibility with RunPod (linux/amd64).
Supports separate versioning per service.
"""

import argparse
import os
import subprocess
import sys
from enum import Enum
from typing import List, Tuple, Dict, Any

# Configuration
MOD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "mod")
REGISTRY_PREFIX = "ucede/nonce"

class Service(Enum):
    ASSESSMENT = "assessment"
    GENERATION = "generation"

SERVICES = {
    Service.ASSESSMENT: {
        "name": "assessment",
        "dir_name": "assessment",
        "dockerfile": "assessment/Dockerfile",
        "image": f"{REGISTRY_PREFIX}-assessment"
    },
    Service.GENERATION: {
        "name": "generation",
        "dir_name": "ipa_generation",
        "dockerfile": "ipa_generation/Dockerfile",
        "image": f"{REGISTRY_PREFIX}-generation"
    }
}

class Color:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_step(msg: str):
    print(f"\n{Color.BLUE}{Color.BOLD}>>> {msg}{Color.ENDC}")

def print_success(msg: str):
    print(f"{Color.GREEN}✔ {msg}{Color.ENDC}")

def print_warning(msg: str):
    print(f"{Color.WARNING}⚠ {msg}{Color.ENDC}")

def print_error(msg: str):
    print(f"{Color.FAIL}✖ {msg}{Color.ENDC}")

def run_command(cmd: List[str], cwd: str = None, dry_run: bool = False, check: bool = True) -> bool:
    cmd_str = " ".join(cmd)
    if dry_run:
        print(f"{Color.CYAN}[DRY RUN] {cmd_str}{Color.ENDC}")
        return True
    
    print(f"{Color.CYAN}$ {cmd_str}{Color.ENDC}")
    try:
        subprocess.run(cmd, cwd=cwd, check=check)
        return True
    except subprocess.CalledProcessError as e:
        print_error(f"Command failed: {e}")
        if check:
            sys.exit(1)
        return False

def get_version_file_path(service_config: Dict[str, Any]) -> str:
    return os.path.join(MOD_DIR, service_config["dir_name"], "VERSION")

def get_current_version(service_config: Dict[str, Any]) -> str:
    path = get_version_file_path(service_config)
    if not os.path.exists(path):
        return "0.0.0"
    with open(path, "r") as f:
        return f.read().strip()

def save_version(service_config: Dict[str, Any], version: str):
    path = get_version_file_path(service_config)
    with open(path, "w") as f:
        f.write(version)

def bump_version(current: str, bump_type: str) -> str:
    parts = current.split(".")
    major = int(parts[0])
    minor = int(parts[1]) if len(parts) > 1 else 0
    patch = int(parts[2]) if len(parts) > 2 else 0

    if bump_type == "major":
        major += 1
        minor = 0
        patch = 0
    elif bump_type == "minor":
        minor += 1
        patch = 0
    elif bump_type == "patch":
        patch += 1
    return f"{major}.{minor}.{patch}"

def select_services() -> List[Service]:
    print("\nWhich services do you want to deploy?")
    print("1. Assessment (Whisper + MFA)")
    print("2. IPA Generation (POWSM G2P)")
    print("3. Both")
    
    while True:
        choice = input(f"{Color.BOLD}Select [1-3]: {Color.ENDC}").strip()
        if choice == "1":
            return [Service.ASSESSMENT]
        elif choice == "2":
            return [Service.GENERATION]
        elif choice == "3":
            return [Service.ASSESSMENT, Service.GENERATION]
        print_error("Invalid selection. Please try again.")

def select_version_bump(service_name: str, current_version: str) -> str:
    print(f"\n{Color.HEADER}Configuration for {service_name.upper()}{Color.ENDC}")
    print(f"Current version: {Color.BOLD}{current_version}{Color.ENDC}")
    print("Select version bump type:")
    print(f"1. Patch ({bump_version(current_version, 'patch')})")
    print(f"2. Minor ({bump_version(current_version, 'minor')})")
    print(f"3. Major ({bump_version(current_version, 'major')})")
    print("4. Skip version bump (re-deploy current)")
    
    while True:
        choice = input(f"{Color.BOLD}Select [1-4]: {Color.ENDC}").strip()
        if choice == "1": return "patch"
        if choice == "2": return "minor"
        if choice == "3": return "major"
        if choice == "4": return "none"
        print_error("Invalid selection.")

def main():
    parser = argparse.ArgumentParser(description="Deploy RunPod containers")
    parser.add_argument("--dry-run", action="store_true", help="Simulate commands without executing")
    parser.add_argument("--skip-build", action="store_true", help="Skip build step (tag & push only)")
    args = parser.parse_args()

    # 1. Select Services
    selected_services = select_services()
    
    # 2. Collect configurations for each service
    service_actions = [] # List of tuples: (ServiceEnum, new_version, bump_type)
    
    for service_enum in selected_services:
        svc_config = SERVICES[service_enum]
        current_version = get_current_version(svc_config)
        bump_type = select_version_bump(svc_config["name"], current_version)
        
        if bump_type != "none":
            new_version = bump_version(current_version, bump_type)
        else:
            new_version = current_version
            
        service_actions.append((service_enum, new_version, bump_type))

    # Confirmation
    print(f"\n{Color.HEADER}Deployment Summary:{Color.ENDC}")
    for service_enum, new_ver, bump in service_actions:
        svc_config = SERVICES[service_enum]
        svc_name = svc_config["name"]
        old_ver = get_current_version(svc_config)
        
        if bump != "none":
            print(f"  • {svc_name}: {Color.BOLD}{old_ver} -> {new_ver}{Color.ENDC} ({bump})")
        else:
            print(f"  • {svc_name}: {new_ver} (no change)")
            
    print(f"  Dry Run:  {'Yes' if args.dry_run else 'No'}")
    
    confirm = input(f"\n{Color.BOLD}Proceed? [y/N]: {Color.ENDC}").strip().lower()
    if confirm != 'y':
        print("Aborted.")
        sys.exit(0)

    # 3. Execution Loop
    for service_enum, new_version, bump_type in service_actions:
        svc_config = SERVICES[service_enum]
        print_step(f"Deploying {svc_config['name']} v{new_version}...")

        # Update Version File
        if bump_type != "none" and not args.dry_run:
            save_version(svc_config, new_version)
            print_success(f"Updated VERSION to {new_version}")

        image_tag = f"{svc_config['image']}:v{new_version}"
        latest_tag = f"{svc_config['image']}:latest"

        # Build
        if not args.skip_build:
            print(f"Building {image_tag} (amd64)...")
            build_cmd = [
                "docker", "build",
                "--platform", "linux/amd64",
                "-f", svc_config["dockerfile"],
                "-t", image_tag,
                "-t", latest_tag,
                "."
            ]
            run_command(build_cmd, cwd=MOD_DIR, dry_run=args.dry_run)
            print_success("Build complete")
        else:
            print_warning("Skipping build step. Pushing existing images.")

        # Push
        print(f"Pushing {image_tag}...")
        run_command(["docker", "push", image_tag], dry_run=args.dry_run)
        print_success(f"Pushed {image_tag}")
        
    # Final Instructions
    print_step("Deployment Complete!")
    print(f"\n{Color.HEADER}{Color.BOLD}IMPORTANT NEXT STEPS:{Color.ENDC}")
    print(f"1. Go to RunPod Console -> Templates")
    for service_enum, new_version, _ in service_actions:
        svc_config = SERVICES[service_enum]
        print(f"2. Edit {svc_config['name']} template -> Image: {Color.GREEN}{svc_config['image']}:v{new_version}{Color.ENDC}")
    print(f"3. Re-deploy endpoints.")

if __name__ == "__main__":
    main()
