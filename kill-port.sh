#!/bin/sh
# Kill process(es) on given port(s). No lsof/fuser. Usage: ./kill-port.sh 5173 5174
for port in "$@"; do
  hex=$(printf '%04x' "$port")
  inodes=$(awk -v h="$hex" '$2 ~ ":" h "$" {print $10}' /proc/net/tcp 2>/dev/null)
  for inode in $inodes; do
    for fd in /proc/[0-9]*/fd/* 2>/dev/null; do
      [ -L "$fd" ] || continue
      [ "$(readlink "$fd" 2>/dev/null)" = "socket:[$inode]" ] || continue
      pid="${fd#/proc/}"
      pid="${pid%%/fd/*}"
      kill -9 "$pid" 2>/dev/null && echo "Killed $pid (port $port)"
    done
  done
done
