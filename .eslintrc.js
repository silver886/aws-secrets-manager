module.exports = {
    'env': {
        'es2020': true,
        'node': true,
    },
    'extends': [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    'parser': '@typescript-eslint/parser',
    'parserOptions': {
        'ecmaVersion': 12,
        'sourceType': 'module',
    },
    'plugins': [
        '@typescript-eslint',
    ],
    'rules': {
        'indent': [
            'error',
            4,
            {
                'SwitchCase': 1, // eslint-disable-line @typescript-eslint/naming-convention
            },
        ],
        'quotes': [
            'error',
            'single',
        ],
        'semi': [
            'error',
            'always',
            {
                'omitLastInOneLineBlock': true,
            },
        ],
        'comma-dangle': [
            'error',
            'always-multiline',
        ],
        'sort-imports': [
            'error',
            {
                'ignoreCase': false,
                'ignoreDeclarationSort': false,
                'ignoreMemberSort': false,
                'memberSyntaxSortOrder': ['none', 'all', 'multiple', 'single'],
                'allowSeparatedGroups': true,
            },
        ],
        '@typescript-eslint/naming-convention': [
            'error',
            {
                'selector': [
                    'variable',
                    'function',
                    'parameter',
                    'parameterProperty',
                    'classProperty',
                    'objectLiteralProperty',
                    'typeProperty',
                    'classMethod',
                    'objectLiteralMethod',
                    'typeMethod',
                    'accessor',
                ],
                'format': ['strictCamelCase'],
                'filter': {
                    'regex': '^_$',
                    'match': false,
                },
                'leadingUnderscore': 'forbid',
                'trailingUnderscore': 'forbid',
            },
            {
                'selector': [
                    'class',
                    'interface',
                    'typeAlias',
                    'typeParameter',
                    'enum',
                ],
                'format': ['StrictPascalCase'],
                'filter': {
                    'regex': '^_$',
                    'match': false,
                },
                'leadingUnderscore': 'forbid',
                'trailingUnderscore': 'forbid',
            },
            {
                'selector': [
                    'enumMember',
                ],
                'format': ['UPPER_CASE'],
                'filter': {
                    'regex': '^_$',
                    'match': false,
                },
                'leadingUnderscore': 'forbid',
                'trailingUnderscore': 'forbid',
            },
            {
                'selector': [
                    'variable',
                    'function',
                ],
                'modifiers': [
                    'global',
                ],
                'format': ['UPPER_CASE'],
                'filter': {
                    'regex': '^_$',
                    'match': false,
                },
                'leadingUnderscore': 'forbid',
                'trailingUnderscore': 'forbid',
            },
        ],
        '@typescript-eslint/member-delimiter-style': [
            'error',
            {
                'multiline': {
                    'delimiter': 'semi',
                    'requireLast': true,
                },
                'singleline': {
                    'delimiter': 'semi',
                    'requireLast': false,
                },
            },
        ],
        '@typescript-eslint/member-ordering': [
            'error',
        ],
    },
};
