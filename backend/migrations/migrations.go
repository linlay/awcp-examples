package migrations

import "embed"

// FS is compiled into the server so migrations do not depend on the launch directory.
//
//go:embed *.sql
var FS embed.FS
