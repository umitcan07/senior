#!/usr/bin/env python3
"""
Local development script for RunPod simulation.
Starts the local Proxy and Worker containers using Docker Compose.
"""

import argparse
# Import shared utilities if we refactored, but for now just duplicate/stay independent to keep it simple.
import os
import subprocess
import sys

# Configuration
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMPOSE_FILE = os.path.join(PROJECT_ROOT, "docker-compose.dev.yml")

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

def print_error(msg: str):
    print(f"{Color.FAIL}✖ {msg}{Color.ENDC}")

def run_command(cmd: list, cwd: str = None, check: bool = True):
    try:
        subprocess.run(cmd, cwd=cwd, check=check)
    except subprocess.CalledProcessError as e:
        print_error(f"Command failed: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nStopping...")
        pass

def check_env():
    # Helper to check if .env exists in app/
    app_env = os.path.join(PROJECT_ROOT, "app", ".env")
    if not os.path.exists(app_env):
        print(f"{Color.WARNING}Warning: app/.env not found. You may need it for the frontend to talk to the local proxy.{Color.ENDC}")

def main():
    parser = argparse.ArgumentParser(description="Run local RunPod simulation")
    parser.add_argument("--clean", action="store_true", help="Remove orphans and volumes before starting")
    parser.add_argument("--detach", "-d", action="store_true", help="Run in detached mode")
    parser.add_argument("--build", action="store_true", default=True, help="Build images before starting (default: True)")
    parser.add_argument("--no-build", action="store_false", dest="build", help="Don't build images")
    
    args = parser.parse_args()

    print_step("Starting Local RunPod Simulation")
    print(f"Project Root: {PROJECT_ROOT}")
    
    check_env()

    cmd = ["docker", "compose", "-f", COMPOSE_FILE, "up"]
    
    if args.build:
        cmd.append("--build")
        
    if args.detach:
        cmd.append("-d")
        
    if args.clean:
        cmd.append("--remove-orphans")

    print_step("Running Docker Compose...")
    print(f"{Color.CYAN}$ {' '.join(cmd)}{Color.ENDC}")
    
    try:
        subprocess.run(cmd, cwd=PROJECT_ROOT)
    except KeyboardInterrupt:
        print(f"\n{Color.WARNING}Inerrupted. Shutting down...{Color.ENDC}")
        subprocess.run(["docker", "compose", "-f", COMPOSE_FILE, "down"], cwd=PROJECT_ROOT)
        sys.exit(0)

if __name__ == "__main__":
    main()
