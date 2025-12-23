package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	ForbiddenKeywords []string `yaml:"forbidden_keywords"`
}

func LoadConfig(path string) (*Config, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var cfg Config
	err = yaml.NewDecoder(f).Decode(&cfg)
	return &cfg, err
}
