# Canonical Keybindings

Generated from key router + action-bearing key router tests via:

- `python3 scripts/keybind-sync-audit.py`
- `bun scripts/generate-keybind-doc.ts`

Canonical keybind count: 70

| Key          | Code Evidence                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| `/`          | src/app/keyRouter.test.ts:1831<br>src/app/keyRouter.test.ts:1831<br>src/app/keyRouter.ts:1575<br>+2 more       |
| `1`          | src/app/keyRouter.test.ts:1220<br>src/app/keyRouter.test.ts:1220<br>src/app/keyRouter.test.ts:1243<br>+13 more |
| `2`          | src/app/keyRouter.test.ts:1432<br>src/app/keyRouter.test.ts:1432<br>src/app/keyRouter.test.ts:1468<br>+9 more  |
| `3`          | src/app/keyRouter.test.ts:1456<br>src/app/keyRouter.test.ts:1456<br>src/app/keyRouter.test.ts:368<br>+7 more   |
| `4`          | src/app/keyRouter.test.ts:1420<br>src/app/keyRouter.test.ts:1420<br>src/app/keyRouter.test.ts:1571<br>+3 more  |
| `?`          | src/app/keyRouter.test.ts:1144<br>src/app/keyRouter.ts:1399<br>src/app/keyRouter.ts:583<br>+1 more             |
| `A`          | src/app/keyRouter.ts:1926<br>src/app/keyRouter.ts:1926                                                         |
| `ArrowDown`  | src/app/keyRouter.test.ts:1098<br>src/app/keyRouter.test.ts:1188<br>src/app/keyRouter.test.ts:1426<br>+21 more |
| `ArrowLeft`  | src/app/keyRouter.test.ts:1197<br>src/app/keyRouter.test.ts:1279<br>src/app/keyRouter.test.ts:1288<br>+10 more |
| `ArrowRight` | src/app/keyRouter.test.ts:1200<br>src/app/keyRouter.test.ts:1273<br>src/app/keyRouter.test.ts:1285<br>+14 more |
| `ArrowUp`    | src/app/keyRouter.test.ts:1095<br>src/app/keyRouter.test.ts:1185<br>src/app/keyRouter.test.ts:1474<br>+19 more |
| `B`          | src/app/keyRouter.test.ts:905<br>src/app/keyRouter.test.ts:905<br>src/app/keyRouter.ts:291<br>+1 more          |
| `C`          | src/app/keyRouter.ts:1850<br>src/app/keyRouter.ts:1850<br>src/app/keyRouter.ts:1901<br>+1 more                 |
| `Ctrl+D`     | src/app/keyRouter.test.ts:1194<br>src/app/keyRouter.test.ts:1609<br>src/app/keyRouter.test.ts:836<br>+2 more   |
| `Ctrl+F`     | src/app/keyRouter.test.ts:963                                                                                  |
| `Ctrl+G`     | src/app/keyRouter.test.ts:812<br>src/app/keyRouter.ts:1968                                                     |
| `Ctrl+L`     | src/app/keyRouter.test.ts:1597<br>src/app/keyRouter.ts:1657<br>src/app/keyRouter.ts:1657                       |
| `Ctrl+N`     | src/app/keyRouter.test.ts:1931<br>src/app/keyRouter.test.ts:1934<br>src/app/keyRouter.test.ts:1946<br>+3 more  |
| `Ctrl+P`     | src/app/keyRouter.test.ts:815<br>src/app/keyRouter.ts:1972                                                     |
| `Ctrl+S`     | src/app/keyRouter.test.ts:1594<br>src/app/keyRouter.test.ts:842<br>src/app/keyRouter.ts:1123<br>+9 more        |
| `Ctrl+U`     | src/app/keyRouter.test.ts:1191<br>src/app/keyRouter.test.ts:1450<br>src/app/keyRouter.test.ts:1606<br>+3 more  |
| `Ctrl+Y`     | src/app/keyRouter.test.ts:818<br>src/app/keyRouter.ts:1976                                                     |
| `D`          | src/app/keyRouter.test.ts:329<br>src/app/keyRouter.test.ts:329<br>src/app/keyRouter.ts:1022<br>+4 more         |
| `E`          | src/app/keyRouter.test.ts:874<br>src/app/keyRouter.test.ts:874<br>src/app/keyRouter.ts:1856<br>+5 more         |
| `Enter`      | src/app/keyRouter.test.ts:1005<br>src/app/keyRouter.test.ts:1044<br>src/app/keyRouter.test.ts:1075<br>+84 more |
| `Esc`        | src/app/keyRouter.test.ts:1011<br>src/app/keyRouter.test.ts:112<br>src/app/keyRouter.test.ts:1223<br>+47 more  |
| `G`          | src/app/keyRouter.test.ts:830<br>src/app/keyRouter.test.ts:830<br>src/app/keyRouter.ts:1025<br>+2 more         |
| `I`          | src/app/keyRouter.test.ts:1828<br>src/app/keyRouter.test.ts:1828<br>src/app/keyRouter.ts:1530<br>+3 more       |
| `L`          | src/app/keyRouter.ts:1853<br>src/app/keyRouter.ts:1853<br>src/app/keyRouter.ts:1904<br>+3 more                 |
| `O`          | src/app/keyRouter.ts:1844<br>src/app/keyRouter.ts:1846<br>src/app/keyRouter.ts:1895<br>+1 more                 |
| `PageDown`   | src/app/keyRouter.test.ts:1444<br>src/app/keyRouter.test.ts:1492<br>src/app/keyRouter.test.ts:1603<br>+3 more  |
| `PageUp`     | src/app/keyRouter.test.ts:1486<br>src/app/keyRouter.test.ts:1600<br>src/app/keyRouter.ts:275<br>+2 more        |
| `R`          | src/app/keyRouter.test.ts:1822<br>src/app/keyRouter.test.ts:1822<br>src/app/keyRouter.ts:1571<br>+3 more       |
| `S`          | src/app/keyRouter.ts:1019                                                                                      |
| `Space`      | src/app/keyRouter.test.ts:1170<br>src/app/keyRouter.test.ts:1203<br>src/app/keyRouter.test.ts:1549<br>+6 more  |
| `Tab`        | src/app/keyRouter.test.ts:1055<br>src/app/keyRouter.test.ts:1116<br>src/app/keyRouter.test.ts:1119<br>+12 more |
| `U`          | src/app/keyRouter.ts:1910<br>src/app/keyRouter.ts:1910                                                         |
| `[`          | src/app/keyRouter.ts:597<br>src/app/keyRouter.ts:597                                                           |
| `]`          | src/app/keyRouter.test.ts:893<br>src/app/keyRouter.test.ts:893<br>src/app/keyRouter.ts:592<br>+1 more          |
| `a`          | src/app/keyRouter.test.ts:1710<br>src/app/keyRouter.test.ts:1710<br>src/app/keyRouter.test.ts:1813<br>+28 more |
| `b`          | src/app/keyRouter.test.ts:902<br>src/app/keyRouter.test.ts:902<br>src/app/keyRouter.ts:291<br>+1 more          |
| `backspace`  | src/app/keyRouter.test.ts:1276<br>src/app/keyRouter.test.ts:1318<br>src/app/keyRouter.test.ts:1735<br>+4 more  |
| `c`          | src/app/keyRouter.test.ts:396<br>src/app/keyRouter.test.ts:396<br>src/app/keyRouter.test.ts:421<br>+18 more    |
| `d`          | src/app/keyRouter.test.ts:1194<br>src/app/keyRouter.test.ts:1609<br>src/app/keyRouter.test.ts:1716<br>+35 more |
| `e`          | src/app/keyRouter.test.ts:1713<br>src/app/keyRouter.test.ts:1713<br>src/app/keyRouter.test.ts:737<br>+14 more  |
| `end`        | src/app/keyRouter.ts:335                                                                                       |
| `f`          | src/app/keyRouter.test.ts:1104<br>src/app/keyRouter.test.ts:1104<br>src/app/keyRouter.test.ts:232<br>+7 more   |
| `g`          | src/app/keyRouter.test.ts:1107<br>src/app/keyRouter.test.ts:1107<br>src/app/keyRouter.test.ts:332<br>+19 more  |
| `h`          | src/app/keyRouter.test.ts:1555<br>src/app/keyRouter.test.ts:1555<br>src/app/keyRouter.ts:875<br>+5 more        |
| `home`       | src/app/keyRouter.ts:334                                                                                       |
| `i`          | src/app/keyRouter.test.ts:1825<br>src/app/keyRouter.test.ts:1825<br>src/app/keyRouter.test.ts:1903<br>+9 more  |
| `j`          | src/app/keyRouter.test.ts:1065<br>src/app/keyRouter.test.ts:1065<br>src/app/keyRouter.test.ts:1698<br>+29 more |
| `k`          | src/app/keyRouter.test.ts:1701<br>src/app/keyRouter.test.ts:1701<br>src/app/keyRouter.test.ts:754<br>+19 more  |
| `l`          | src/app/keyRouter.test.ts:1597<br>src/app/keyRouter.test.ts:618<br>src/app/keyRouter.test.ts:618<br>+15 more   |
| `m`          | src/app/keyRouter.test.ts:1519<br>src/app/keyRouter.test.ts:1519<br>src/app/keyRouter.test.ts:809<br>+5 more   |
| `n`          | src/app/keyRouter.test.ts:1779<br>src/app/keyRouter.test.ts:1779<br>src/app/keyRouter.test.ts:1786<br>+51 more |
| `o`          | src/app/keyRouter.test.ts:1732<br>src/app/keyRouter.test.ts:1732<br>src/app/keyRouter.ts:1587<br>+5 more       |
| `p`          | src/app/keyRouter.test.ts:1125<br>src/app/keyRouter.test.ts:1125<br>src/app/keyRouter.test.ts:815<br>+9 more   |
| `q`          | src/app/keyRouter.test.ts:1138<br>src/app/keyRouter.test.ts:1138<br>src/app/keyRouter.test.ts:1249<br>+3 more  |
| `r`          | src/app/keyRouter.test.ts:1113<br>src/app/keyRouter.test.ts:1113<br>src/app/keyRouter.test.ts:1819<br>+9 more  |
| `s`          | src/app/keyRouter.test.ts:1594<br>src/app/keyRouter.test.ts:326<br>src/app/keyRouter.test.ts:326<br>+23 more   |
| `t`          | src/app/keyRouter.test.ts:1122<br>src/app/keyRouter.test.ts:1122<br>src/app/keyRouter.test.ts:622<br>+7 more   |
| `u`          | src/app/keyRouter.test.ts:1141<br>src/app/keyRouter.test.ts:1141<br>src/app/keyRouter.test.ts:1191<br>+14 more |
| `v`          | src/app/keyRouter.test.ts:839<br>src/app/keyRouter.test.ts:839<br>src/app/keyRouter.ts:1767<br>+1 more         |
| `w`          | src/app/keyRouter.test.ts:1110<br>src/app/keyRouter.test.ts:1110<br>src/app/keyRouter.ts:1403<br>+1 more       |
| `x`          | src/app/keyRouter.test.ts:1164<br>src/app/keyRouter.test.ts:1164<br>src/app/keyRouter.test.ts:868<br>+2 more   |
| `y`          | src/app/keyRouter.test.ts:178<br>src/app/keyRouter.test.ts:178<br>src/app/keyRouter.test.ts:200<br>+35 more    |
| `z`          | src/app/keyRouter.test.ts:871<br>src/app/keyRouter.test.ts:871<br>src/app/keyRouter.ts:640                     |
| `{`          | src/app/keyRouter.test.ts:896<br>src/app/keyRouter.test.ts:896<br>src/app/keyRouter.ts:607<br>+1 more          |
| `}`          | src/app/keyRouter.ts:602<br>src/app/keyRouter.ts:602                                                           |
