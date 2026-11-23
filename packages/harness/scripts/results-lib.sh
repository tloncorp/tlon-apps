# Sourced by test-hoon.sh, through test-lib.sh, and test-js.sh to record and
# count results. The caller sets `pattern`, `results` and `logs`.

function result
{
  printf '%-48s %s\n' "$1" "$2" | tee -a "$results"
}

function matches
{
  [ -z "$pattern" ] || [[ $1 =~ $pattern ]]
}

# Print the counts and exit non-zero if anything failed.
function summarize
{
  echo
  echo "Summary:"
  echo "  passed:     $(grep -c ' pass' "$results")"
  echo "  skipped:    $(grep -c ' skipped:' "$results")"
  echo "  incomplete: $(grep -c ' incomplete:' "$results")"
  echo "  failed:     $(grep -c ' FAILED' "$results")"
  echo "Logs are in $logs"
  [ -z "$pattern" ] || echo "The test ships are still running; stop them with: just test --stop"
  ! grep -q ' FAILED' "$results"
}
