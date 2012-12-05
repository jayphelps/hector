# As odd as this looks...having some major issues with escaping quotes on top of
# infinitely already escaped quotes, etc. This is the only solution that
# seemed to work. Side effect is that printf %q escapes more than we need which
# adds file size. Feel free to resolve
source=$(<$1)
stage1=$(echo $source)
printf "%q" "$stage1"
