import random

sounds = [
    "meow",
    "meow.",
    "meow?",
    "MEOW!!",
    "mao",
    "mao~",
    "mrrrow",
    "mrrrow...",
    "mrrp?",
    "myaa~",
    "nyaa",
    "prrr...",
    "prrrrrr",
    "grrr...",
    "grrrRRR",
    "shaaah!",
    "SHAAAH!!",
    "fssssss",
    "...",
    None,  # 何も言わない
    None,
    None,
]

cats = [
    " /\\_/\\  \n( -ω- ) {sound}\n > ^ <  ",
    " /\\_/\\  \n( 'A' ) {sound}\n  > ~ <  ",
    "  /\\  /\\ \n ( 'Y' ) {sound}\n  =( Y )= ",
]

choice = random.choice(sounds)

if choice is None:
    # 無言の猫
    print(" /\\_/\\ ")
    print("(  . . )")
    print(" >    < ")
else:
    cat = random.choice(cats)
    print(cat.format(sound=choice))
