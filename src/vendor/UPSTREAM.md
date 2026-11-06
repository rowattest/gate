# Vendor copies

These three files are byte for byte copies of RowAttest's own verification code.

| File | Upstream path | sha256 |
| --- | --- | --- |
| src/vendor/verify.ts | shared/src/verify.ts | 7fbcbed5135fa8274dc67cc8cb848ad86b04366c570a9be47d49bb7c88dbdef3 |
| src/vendor/jcs.ts | shared/src/jcs.ts | f344304a9778775b0945b510960e4a84a42eaa1ed77df47d5eeec0437bdf7afc |
| src/vendor/keys.ts | shared/src/keys.ts | 30c0edea36d7b5ac3531076940ecc9f2d23270376a5182874113689b1989d683 |

Source repository: rowattest-app (private), commit b39faec5758cff942568ffd252467cdc2d75a8bb.

The rule: these files are never edited here. A change upstream is copied here with the hashes above updated in the same commit.
test/vendor-pins.test.ts reads this table and fails if a copy differs from its hash, so there is one verification implementation, not two.
