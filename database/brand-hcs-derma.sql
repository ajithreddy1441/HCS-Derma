-- Run this in phpMyAdmin on u611284906_xova to set the company name
INSERT INTO settings (setting_key, setting_value) VALUES ('company_name', 'HCS DERMA')
ON DUPLICATE KEY UPDATE setting_value = 'HCS DERMA';
