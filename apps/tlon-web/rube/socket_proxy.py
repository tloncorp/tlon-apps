#!/usr/bin/env python3
"""
Socket proxy for reliable Unix socket communication on macOS
Replaces nc for conn.c communication
"""
import socket
import sys
import time
import select

def main():
    if len(sys.argv) != 2:
        print("Usage: socket_proxy.py <socket_path>", file=sys.stderr)
        sys.exit(1)
    
    socket_path = sys.argv[1]
    
    try:
        # Read input data
        input_data = sys.stdin.buffer.read()
        
        # Connect to socket
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.connect(socket_path)
        
        # Send data
        sock.sendall(input_data)
        
        # Wait a bit before shutdown to let conn.c process
        time.sleep(0.5)
        
        # Shutdown write side but keep reading
        try:
            sock.shutdown(socket.SHUT_WR)
        except OSError:
            # Socket might already be closed by server
            pass
        
        # Read response with timeout and retry logic
        sock.settimeout(1.0)
        response = b''
        max_retries = 10
        
        for retry in range(max_retries):
            try:
                chunk = sock.recv(4096)
                if not chunk:
                    break
                response += chunk
            except socket.timeout:
                # If we haven't received anything yet, keep waiting
                if not response and retry < max_retries - 1:
                    continue
                break
            except Exception:
                break
        
        sock.close()
        
        # Write response to stdout
        if response:
            sys.stdout.buffer.write(response)
            sys.stdout.buffer.flush()
        
    except Exception as e:
        print(f"Socket error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()