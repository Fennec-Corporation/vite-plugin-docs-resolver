{
  description = "Node.js and pnpm development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_22
            pnpm
          ];

          shellHook = ''
            # Prevent pnpm from downloading unpatched @pnpm/exe binaries on NixOS
            export npm_config_manage_package_manager_versions=false
            export COREPACK_ENABLE_STRICT=0

            echo "Node.js $(node --version)"
            echo "pnpm $(pnpm --version)"
          '';
        };
      });
}
